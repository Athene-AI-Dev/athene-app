// ============================================================
// extractor.ts — Entity & relationship extraction adapter (ATH-58)
//
// Also re-exports extractSchemaEntities from bi-chunking.ts so
// callers can import everything KG-related from this module.
//
// Runs a cheap LLM call (Haiku) over each chunk and returns
// typed KGNode[] / KGEdge[]. The caller owns persistence.
//
// Rule #2: chunks arrive in RAM and leave as graph structures.
// This file never touches Supabase.
// ============================================================

import { SystemMessage, HumanMessage } from "@langchain/core/messages";
export { extractSchemaEntities } from "@/lib/integrations/bi-chunking";
import { resolveModelClient } from "@/lib/langgraph/llm-factory";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EntityType,
  ExtractionResult,
  ExtractorChunk,
  KGEdge,
  KGNode,
  KGProvenance,
  Visibility,
} from "./types";
import {
  strongerProvenance,
  unionStrings,
  maxVisibility,
  nodeKey as makeNodeKey,
} from "./utils";

const EXTRACTION_PROMPT = `# Entity & Relationship Extraction Prompt

You are an entity and relationship extractor. You read a passage of text from an enterprise document and produce a structured JSON object describing the entities it mentions and how they relate.

## Entity types

Only use these values for \`entity_type\`:

- \`person\` — named individual
- \`project\` — named initiative, codename, or body of work
- \`service\` — internal or external service/system (e.g. "Billing Service", "Stripe")
- \`team\` — organizational team or department
- \`technology\` — tool, framework, language, protocol (e.g. "PostgreSQL", "Kubernetes")
- \`process\` — named procedure or workflow (e.g. "Quarterly Close", "Incident Response")
- \`concept\` — domain concept that doesn't fit above
- \`organization\` — external company / legal entity
- \`product\` — shippable product or SKU

## Relation types

Only use these values for \`relation\`:

- \`DEPENDS_ON\` — X cannot function without Y
- \`OWNS\` — X is accountable for / has authority over Y
- \`FEEDS\` — X provides data/inputs to Y
- \`MENTIONS\` — X refers to Y without a stronger semantic link
- \`USES\` — X consumes / leverages Y
- \`RELATED_TO\` — unclear but adjacent
- \`PART_OF\` — X is a component of Y
- \`WORKS_ON\` — person works on project/service

## Provenance rules

For every relationship, set \`provenance\` to one of:

- \`EXTRACTED\` — the relationship is **directly stated** in the text ("X depends on Y", "A owns B"). Confidence MUST be \`1.0\`.
- \`INFERRED\` — a reasonable inference from context but not stated verbatim. Confidence in \`[0.5, 0.95]\`.
- \`AMBIGUOUS\` — you are unsure whether it holds or which direction applies. Confidence in \`[0.0, 0.5]\`.

Err toward \`AMBIGUOUS\` when in doubt. A flagged edge is recoverable; a wrong \`EXTRACTED\` edge is not.

## Semantic similarity

If two entities in the passage solve the same problem or represent the same idea without any
direct structural link, add a \`RELATED_TO\` edge with provenance \`INFERRED\` and confidence
between 0.6 and 0.8. Only do this when the similarity is genuinely non-obvious.

## Rationale edges

If the passage explains WHY a decision was made, extract a node for the reasoning and add a
\`RELATED_TO\` edge from that reasoning node to the concept it justifies. Use provenance
\`EXTRACTED\` when the rationale is stated directly, \`INFERRED\` when it is implied.

## Confidence scoring rules

Never use 0.5 as a default score. Apply these precisely:
- \`EXTRACTED\` edges: confidence MUST be 1.0 (it is stated verbatim in the text)
- \`INFERRED\` with direct structural evidence: 0.8–0.9
- \`INFERRED\` with reasonable but uncertain inference: 0.6–0.7
- \`INFERRED\` when speculative: 0.4–0.5
- \`AMBIGUOUS\` edges: 0.1–0.3

## Output format

Return a single JSON object with exactly two keys: \`entities\` and \`relationships\`. No prose, no code fences.

## Rules

1. Deduplicate entities within a single response. Each (label, entity_type) pair appears once.
2. Every \`source\` and \`target\` in \`relationships\` MUST also appear in \`entities\`.
3. Labels are human-readable names as they appear in the text (canonical form, singular, title-case when appropriate). Do not invent identifiers.
4. If the passage contains no meaningful entities, return \`{"entities":[],"relationships":[]}\`.
5. Do not include quotes from the source text. Descriptions are your own concise summaries (≤ 140 chars).
6. Do not include PII you would not want logged. Anonymize email addresses and phone numbers.`;

function loadPrompt(): string {
  return EXTRACTION_PROMPT;
}

// ---- Raw LLM response shape -----------------------------------

type RawEntity = {
  label?: unknown;
  entity_type?: unknown;
  description?: unknown;
};

type RawRelationship = {
  source?: unknown;
  source_entity_type?: unknown;
  target?: unknown;
  target_entity_type?: unknown;
  relation?: unknown;
  provenance?: unknown;
  confidence?: unknown;
};

type RawExtraction = {
  entities?: RawEntity[];
  relationships?: RawRelationship[];
};

// ---- JSON coercion --------------------------------------------

/**
 * Extract the first JSON object from an LLM response. Haiku usually
 * returns clean JSON but occasionally wraps it in ```json fences or
 * adds a sentence — strip those defensively.
 */
function parseJSON(raw: string): RawExtraction | null {
  const trimmed = raw.trim();
  // fast path: raw JSON
  try {
    return JSON.parse(trimmed) as RawExtraction;
  } catch {
    // fall through
  }
  // strip ```json fences
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]) as RawExtraction;
    } catch {
      // fall through
    }
  }
  // first-brace-to-last-brace fallback
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1)) as RawExtraction;
    } catch {
      return null;
    }
  }
  return null;
}

// ---- Normalization --------------------------------------------

const VALID_PROVENANCE = new Set<KGProvenance>(["EXTRACTED", "INFERRED", "AMBIGUOUS"]);

function normLabel(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const s = x.trim();
  return s.length === 0 || s.length > 200 ? null : s;
}

function normEntityType(x: unknown): EntityType | string | null {
  if (typeof x !== "string") return null;
  const s = x.trim().toLowerCase();
  return s.length === 0 ? null : s;
}

function normProvenance(x: unknown): KGProvenance {
  if (typeof x === "string" && VALID_PROVENANCE.has(x.toUpperCase() as KGProvenance)) {
    return x.toUpperCase() as KGProvenance;
  }
  return "AMBIGUOUS";
}

function normConfidence(x: unknown, provenance: KGProvenance): number {
  let n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) n = provenance === "EXTRACTED" ? 1.0 : 0.5;
  // Clamp to [0, 1]
  n = Math.max(0, Math.min(1, n));
  // EXTRACTED edges must be confidence 1.0 per prompt contract
  if (provenance === "EXTRACTED") n = 1.0;
  return n;
}

// ---- Single-chunk extraction ----------------------------------

async function extractFromChunk(
  chunk: ExtractorChunk,
  orgId: string
): Promise<ExtractionResult> {
  const systemPrompt = loadPrompt();

  let raw: string;
  try {
    const llm = await resolveModelClient("medium", orgId);
    const res = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(
        `Extract entities and relationships from the following passage. Return JSON only.\n\n---\n${chunk.text}\n---`
      ),
    ]);
    const content = res.content;
    raw = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c: any) => c.text ?? "").join("")
        : "";
  } catch (err) {
    console.error(
      "[kg/extractor] LLM call failed:",
      err instanceof Error ? err.message : String(err)
    );
    return { nodes: [], edges: [] };
  }

  const parsed = parseJSON(raw);
  if (!parsed) {
    console.warn("[kg/extractor] Could not parse LLM response as JSON");
    return { nodes: [], edges: [] };
  }

  const deptIds = chunk.department_id ? [chunk.department_id] : [];

  // Normalize entities
  const nodes: KGNode[] = [];
  const seenNodes = new Set<string>();

  for (const e of parsed.entities ?? []) {
    const label = normLabel(e.label);
    const entityType = normEntityType(e.entity_type);
    if (!label || !entityType) continue;

    const key = makeNodeKey(label, entityType);
    if (seenNodes.has(key)) continue;
    seenNodes.add(key);

    const description =
      typeof e.description === "string" && e.description.trim().length > 0
        ? e.description.trim().slice(0, 140)
        : null;

    nodes.push({
      org_id: chunk.org_id,
      label,
      entity_type: entityType,
      department_ids: deptIds,
      visibility: chunk.visibility,
      source_documents: [chunk.document_id],
      description,
    });
  }

  // Build edges — only keep ones whose endpoints exist in nodes
  const nodeKeys = new Set(nodes.map((n) => `${n.label}::${n.entity_type}`));
  const edges: KGEdge[] = [];
  const seenEdges = new Set<string>();

  for (const r of parsed.relationships ?? []) {
    const sourceLabel = normLabel(r.source);
    const targetLabel = normLabel(r.target);
    const sourceType = normEntityType(r.source_entity_type);
    const targetType = normEntityType(r.target_entity_type);
    const relation =
      typeof r.relation === "string" && r.relation.trim().length > 0
        ? r.relation.trim().toUpperCase()
        : null;

    if (!sourceLabel || !targetLabel || !sourceType || !targetType || !relation) continue;
    if (!nodeKeys.has(`${sourceLabel}::${sourceType}`)) continue;
    if (!nodeKeys.has(`${targetLabel}::${targetType}`)) continue;

    const provenance = normProvenance(r.provenance);
    const confidence = normConfidence(r.confidence, provenance);

    const key = `${sourceLabel}::${sourceType}->${relation}->${targetLabel}::${targetType}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);

    edges.push({
      org_id: chunk.org_id,
      source_label: sourceLabel,
      source_entity_type: sourceType,
      target_label: targetLabel,
      target_entity_type: targetType,
      relation,
      provenance,
      confidence,
      source_document: chunk.document_id,
      department_id: chunk.department_id ?? null,
      visibility: chunk.visibility,
    });
  }

  return { nodes, edges };
}

// ---- Public API -----------------------------------------------

/**
 * Extract entities and relationships from a batch of chunks.
 *
 * Runs the LLM per chunk, merges results, and deduplicates nodes by
 * `(org_id, label, entity_type)` (matching the kg_nodes UNIQUE
 * constraint). When the same node appears in multiple chunks, the
 * merged record unions `department_ids` and `source_documents`.
 */
export async function extractEntitiesAndRelations(
  chunks: ExtractorChunk[],
  _supabase: SupabaseClient
): Promise<ExtractionResult> {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return { nodes: [], edges: [] };
  }

  const orgId = chunks[0].org_id;

  // Running chunk LLM calls in parallel up to a small cap
  const CONCURRENCY = 5;
  const chunkResults: ExtractionResult[] = [];
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map((chunk) => extractFromChunk(chunk, orgId))
    );
    chunkResults.push(...settled);
  }

  // Merge nodes by (org_id, label, entity_type)
  const nodeMap = new Map<string, KGNode>();
  for (const res of chunkResults) {
    for (const n of res.nodes) {
      const key = `${n.org_id}::${makeNodeKey(n.label, n.entity_type)}`;
      const existing = nodeMap.get(key);
      if (!existing) {
        nodeMap.set(key, {
          ...n,
          department_ids: [...n.department_ids],
          source_documents: [...n.source_documents],
        });
      } else {
        existing.department_ids = unionStrings(
          existing.department_ids,
          n.department_ids
        );
        existing.source_documents = unionStrings(
          existing.source_documents,
          n.source_documents
        );
        // Prefer the first non-empty description; broaden visibility if needed
        if (!existing.description && n.description) existing.description = n.description;
        existing.visibility = maxVisibility(existing.visibility, n.visibility);
      }
    }
  }

  // Merge edges by (org_id, source, target, relation). Keep highest
  // confidence and strongest provenance.
  const edgeMap = new Map<string, KGEdge>();
  for (const res of chunkResults) {
    for (const e of res.edges) {
      const key = `${e.org_id}::${e.source_label}::${e.source_entity_type}->${e.relation}->${e.target_label}::${e.target_entity_type}`;
      const existing = edgeMap.get(key);
      if (!existing) {
        edgeMap.set(key, { ...e });
      } else {
        existing.provenance = strongerProvenance(existing.provenance, e.provenance);
        existing.confidence = Math.max(existing.confidence, e.confidence);
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
