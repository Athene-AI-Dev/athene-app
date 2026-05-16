-- Sprint 4A: Entity linking via label embeddings
-- Adds label_embedding (768-dim) and canonical_id to kg_nodes.
-- find_canonical_node() RPC finds the closest existing root node by cosine
-- similarity, enabling fuzzy dedup: "AWS" and "Amazon Web Services" merge
-- into a single canonical node at 0.92 similarity threshold.

ALTER TABLE kg_nodes
  ADD COLUMN IF NOT EXISTS label_embedding vector(768),
  ADD COLUMN IF NOT EXISTS canonical_id uuid REFERENCES kg_nodes(id) ON DELETE SET NULL;

-- IVFFlat index for fast cosine similarity search among root nodes
CREATE INDEX IF NOT EXISTS kg_nodes_label_embedding_idx
  ON kg_nodes USING ivfflat (label_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for canonical_id lookups (alias → root resolution)
CREATE INDEX IF NOT EXISTS kg_nodes_canonical_id_idx
  ON kg_nodes(canonical_id)
  WHERE canonical_id IS NOT NULL;

-- RPC: find the nearest canonical (root) node above the similarity threshold.
-- Only matches against root nodes (canonical_id IS NULL) to avoid chains.
-- Returns NULL if no match exceeds the threshold.
CREATE OR REPLACE FUNCTION find_canonical_node(
  p_org_id uuid,
  p_embedding vector(768),
  p_entity_type text,
  p_threshold float DEFAULT 0.92
) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM kg_nodes
  WHERE org_id = p_org_id
    AND entity_type = p_entity_type
    AND label_embedding IS NOT NULL
    AND canonical_id IS NULL
    AND 1 - (label_embedding <=> p_embedding) >= p_threshold
  ORDER BY label_embedding <=> p_embedding
  LIMIT 1;
$$;

COMMENT ON FUNCTION find_canonical_node IS
  'Finds the nearest root KG node above the cosine similarity threshold. Used by the extractor to merge alias nodes (e.g. "AWS" and "Amazon Web Services") into a single canonical entity.';
