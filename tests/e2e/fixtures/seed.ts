/**
 * tests/e2e/fixtures/seed.ts
 *
 * Exports a Playwright `test` fixture that seeds:
 *   - A deterministic "seed-org" organisation row
 *   - org_members rows for the real Clerk test account
 *   - A synthetic Google Drive connection row
 *   - Synthetic documents + embeddings for retrieval assertions
 *   - Synthetic graph nodes/edges for citation assertions
 *   - Audit rows for BI cross-dept assertions
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS.
 * All rows are keyed with stable UUIDs so re-runs are idempotent.
 *
 * Embeddings are generated via the Jina AI API (JINA_API_KEY from .env.local).
 * If the key is absent, document seeding is skipped — other seeds still run.
 */

import { test as base, expect } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/* ─── stable IDs ────────────────────────────────────────────────────── */
// The real Clerk user ID for mudxssiralam@gmail.com in the dev instance.
// All three test roles use the same account (one real Clerk user in dev).
const REAL_CLERK_USER_ID = process.env.E2E_CLERK_USER_ID ?? "user_3DghfV8knOaC724syP31F8SiYlA";
const REAL_USER_EMAIL = process.env.E2E_MEMBER_EMAIL ?? "mudxssiralam@gmail.com";

export const SEED = {
  orgId: "00000000-0000-0000-0000-000000000001",
  // Member row UUIDs (for org_members.id — must be UUID type)
  adminMemberId: "00000000-0000-0000-0000-000000000010",
  memberMemberId: "00000000-0000-0000-0000-000000000011",
  biAnalystMemberId: "00000000-0000-0000-0000-000000000012",
  // Real Clerk user IDs mapped to seeded roles
  adminUserId: REAL_CLERK_USER_ID,
  memberUserId: REAL_CLERK_USER_ID,
  biAnalystUserId: REAL_CLERK_USER_ID,
  orgName: "Seed Test Org",
  orgSlug: "seed-test-org",
  orgClerkId: "org_seed_test_00000001",
  // Synthetic connection + document IDs for retrieval tests
  connectionId: "00000000-0000-0000-0000-000000000050",
  docIds: {
    refund:  "00000000-0000-0000-0000-000000000051",
    revenue: "00000000-0000-0000-0000-000000000052",
    vendor:  "00000000-0000-0000-0000-000000000053",
    oncall:  "00000000-0000-0000-0000-000000000054",
  },
} as const;

/* ─── fixture graph nodes/edges for graph-citation spec ──────────────── */
const FIXTURE_NODES = [
  {
    id: "00000000-0000-0000-0000-000000000100",
    org_id: SEED.orgId,
    label: "Payment Gateway",
    entity_type: "component",
    visibility: "org_wide",
  },
  {
    id: "00000000-0000-0000-0000-000000000101",
    org_id: SEED.orgId,
    label: "Stripe",
    entity_type: "service",
    visibility: "org_wide",
  },
];

const FIXTURE_EDGES = [
  {
    id: "00000000-0000-0000-0000-000000000200",
    org_id: SEED.orgId,
    source_node: "00000000-0000-0000-0000-000000000100",
    target_node: "00000000-0000-0000-0000-000000000101",
    relation: "DEPENDS_ON",
    provenance: "FIXTURE",
  },
];

/* ─── helpers ──────────────────────────────────────────────────────────── */
function adminSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false } });
}

async function seedOrg(db: SupabaseClient) {
  await db
    .from("organizations")
    .upsert(
      {
        id: SEED.orgId,
        name: SEED.orgName,
        slug: SEED.orgSlug,
        // clerk_org_id must be unique — use a stable value per seed
        clerk_org_id: SEED.orgClerkId,
      },
      { onConflict: "id" }
    )
    .throwOnError();
}

async function seedMembers(db: SupabaseClient) {
  // UNIQUE (org_id, clerk_user_id) prevents the same Clerk user from having
  // multiple roles in the same org. In dev we use one real Clerk account for
  // all test personas, so we insert it with "admin" (superset of all roles).
  // Tests that assert role-specific behaviour work because admin has full access.
  await db
    .from("org_members")
    .upsert(
      {
        id: SEED.adminMemberId,
        org_id: SEED.orgId,
        role: "admin",
        clerk_user_id: REAL_CLERK_USER_ID,
        email: REAL_USER_EMAIL,
        display_name: "E2E Test User",
      },
      { onConflict: "id" }
    )
    .throwOnError();
}

async function seedGraph(db: SupabaseClient) {
  try {
    // Attempt schema A (codebase schema)
    for (const node of FIXTURE_NODES) {
      await db
        .from("kg_nodes")
        .upsert(node, { onConflict: "id" })
        .throwOnError();
    }
    await db.from("kg_edges").upsert(FIXTURE_EDGES, { onConflict: "id" }).throwOnError();
    console.log("[seed] seedGraph codebase schema succeeded!");
  } catch (err: any) {
    console.warn(`[seed] seedGraph codebase schema failed, trying legacy schema: ${err.message}`);
    try {
      // Attempt schema B (legacy schema present on the remote database)
      for (const node of FIXTURE_NODES) {
        const legacyNode = {
          id: node.id,
          org_id: node.org_id,
          label: node.label,
          type: node.entity_type,
        };
        await db
          .from("kg_nodes")
          .upsert(legacyNode, { onConflict: "id,org_id" })
          .throwOnError();
      }
      const legacyEdges = FIXTURE_EDGES.map((edge, i) => ({
        id: i + 1, // bigint ID
        org_id: edge.org_id,
        from_node_id: edge.source_node,
        to_node_id: edge.target_node,
        relation: edge.relation,
      }));
      await db
        .from("kg_edges")
        .upsert(legacyEdges, { onConflict: "id" })
        .throwOnError();
      console.log("[seed] seedGraph legacy schema succeeded!");
    } catch (legacyErr: any) {
      console.warn(`[seed] seedGraph legacy schema also failed: ${legacyErr.message}`);
    }
  }
}

async function seedAuditRows(db: SupabaseClient) {
  // grant_access_audit replaced bi_access_audit after migration 20260511.
  // The BI cross-dept spec filters by accessed_at >= testStartTime so this
  // pre-seeded row will NOT satisfy that assertion — only the live row will.
  await db
    .from("grant_access_audit")
    .upsert(
      [
        {
          id: "00000000-0000-0000-0000-000000000a01",
          org_id: SEED.orgId,
          user_id: SEED.biAnalystMemberId,
          scope_used: "cross_dept",
          document_ids: [],
          accessed_at: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
      { onConflict: "id" }
    )
    .throwOnError();
}

/* ─── synthetic documents for retrieval tests ──────────────────────────── */

const SEED_DOCS = [
  {
    id: SEED.docIds.refund,
    externalId: "seed-doc-refund",
    title: "Refund Policy",
    content:
      "Athene AI Refund Policy: Customers may request a full refund within 30 days of purchase. " +
      "After 30 days, partial refunds may be issued at the discretion of the support team. " +
      "Refund requests must be submitted via the billing portal with the original order number.",
    externalUrl: "https://drive.google.com/file/d/seed-refund",
  },
  {
    id: SEED.docIds.revenue,
    externalId: "seed-doc-revenue",
    title: "Q1 2025 Revenue Report",
    content:
      "Q1 2025 Revenue Report: Total revenue reached $4.2M, up 18% year-over-year. " +
      "SaaS recurring revenue grew by 22%. New customer acquisition was 45 enterprise accounts. " +
      "Churn rate held steady at 1.8% MRR. Pipeline for Q2 is $6.1M.",
    externalUrl: "https://drive.google.com/file/d/seed-revenue",
  },
  {
    id: SEED.docIds.vendor,
    externalId: "seed-doc-vendor",
    title: "Vendor Onboarding SOP",
    content:
      "Vendor Onboarding SOP v2.3: Step 1 — Legal review with 5-business-day SLA owned by the General Counsel's office. " +
      "Step 2 — Security assessment via InfoSec (SOC 2 / ISO 27001 check). " +
      "Step 3 — Finance approval required for contracts over $50k (CFO counter-signature). " +
      "Step 4 — IT Ops provisions SSO access within 48 hours of Finance sign-off.",
    externalUrl: "https://drive.google.com/file/d/seed-vendor",
  },
  {
    id: SEED.docIds.oncall,
    externalId: "seed-doc-oncall",
    title: "Engineering On-Call Runbook",
    content:
      "Engineering On-Call Runbook: PagerDuty escalation threshold is P2 within 15 minutes. " +
      "The on-call engineer must acknowledge within 5 minutes or escalation triggers to the team lead. " +
      "For P1 incidents, wake the VP Engineering immediately. " +
      "Post-mortem required within 48 hours for all P1 and P2 incidents.",
    externalUrl: "https://drive.google.com/file/d/seed-oncall",
  },
] as const;

async function embedWithJina(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY not set — skipping document embedding");
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "jina-embeddings-v3", input: texts, dimensions: 768 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jina embed failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

async function seedDocuments(db: SupabaseClient) {
  // 1. Upsert the synthetic Google Drive connection
  await db
    .from("connections")
    .upsert(
      {
        id: SEED.connectionId,
        org_id: SEED.orgId,
        nango_connection_id: "seed-nango-connection",
        provider: "google",
        source_type: "google_drive",
        scope: "org",
        status: "active",
      },
      { onConflict: "id" }
    )
    .throwOnError();

  // 2. Upsert document metadata rows
  for (const doc of SEED_DOCS) {
    await db
      .from("documents")
      .upsert(
        {
          id: doc.id,
          org_id: SEED.orgId,
          connection_id: SEED.connectionId,
          external_id: doc.externalId,
          title: doc.title,
          source_type: "google_drive",
          visibility: "org_wide",
          external_url: doc.externalUrl,
          chunk_count: 1,
          last_indexed_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .throwOnError();
  }

  // 3. Generate embeddings and upsert into document_embeddings
  const texts = SEED_DOCS.map((d) => d.content);
  const embeddings = await embedWithJina(texts);

  const embeddingRows = SEED_DOCS.map((doc, i) => ({
    org_id: SEED.orgId,
    document_id: doc.id,
    chunk_index: 0,
    content_preview: doc.content.slice(0, 200),
    embedding: `[${embeddings[i].join(",")}]`,
    visibility: "org_wide" as const,
    source_type: "google_drive",
    token_count: Math.ceil(doc.content.length / 4),
    metadata: { title: doc.title, external_url: doc.externalUrl },
  }));

  await db
    .from("document_embeddings")
    .upsert(embeddingRows, { onConflict: "document_id,chunk_index" })
    .throwOnError();
}

/* ─── exported fixture ─────────────────────────────────────────────────── */
export type SeedFixture = {
  seed: typeof SEED;
};

export const test = base.extend<object, SeedFixture>({
  seed: [
    async ({}, use: any) => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (url && key) {
        const db = adminSupabase(url, key);
        await seedOrg(db);
        await seedMembers(db);
        await seedGraph(db);
        // Document seeding calls Jina AI — best-effort, skipped if key absent
        await seedDocuments(db).catch((err: Error) => {
          console.warn(`[seed] seedDocuments skipped: ${err.message}`);
        });
        // Audit seeding is best-effort — ignore if table doesn't exist yet
        await seedAuditRows(db).catch(() => {});
      }

      await use(SEED);
    },
    { scope: "worker" },
  ],
});

export { expect };
