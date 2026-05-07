import type { KGProvenance, Visibility } from "./types";

/**
 * Union two arrays of strings, removing duplicates and empty values.
 */
export function unionStrings(a: string[], b: string[]): string[] {
  const set = new Set<string>();
  for (const s of a) if (s) set.add(s);
  for (const s of b) if (s) set.add(s);
  return Array.from(set);
}

/**
 * Visibility ranking for comparison.
 */
const VISIBILITY_RANK: Record<Visibility, number> = {
  private: 0,
  team: 1,
  public: 2,
};

/**
 * Return the most permissive visibility level.
 */
export function maxVisibility(a: Visibility, b: Visibility): Visibility {
  return (VISIBILITY_RANK[a] ?? 0) >= (VISIBILITY_RANK[b] ?? 0) ? a : b;
}

/**
 * Provenance ranking for comparison (higher = stronger).
 */
const PROVENANCE_RANK: Record<KGProvenance, number> = {
  AMBIGUOUS: 0,
  INFERRED: 1,
  EXTRACTED: 2,
};

/**
 * Return the strongest provenance level.
 */
export function strongerProvenance(a: KGProvenance, b: KGProvenance): KGProvenance {
  return (PROVENANCE_RANK[a] ?? 0) >= (PROVENANCE_RANK[b] ?? 0) ? a : b;
}

/**
 * Generate a unique key for a node based on label and type.
 */
export function nodeKey(label: string, entityType: string): string {
  return `${label}::${entityType}`;
}

/**
 * Generate a unique key for an edge based on source, target, and relation.
 */
export function edgeKey(source: string, target: string, relation: string): string {
  return `${source}->${relation}->${target}`;
}
