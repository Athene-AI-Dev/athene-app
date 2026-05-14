-- Add temporal_metadata column to kg_nodes for decision-type entities
-- and supporting indexes for the /api/graph/decisions query patterns.

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS temporal_metadata jsonb;

-- General entity_type index (used by decisions API and graph filters)
CREATE INDEX IF NOT EXISTS kg_nodes_entity_type_idx
  ON kg_nodes (org_id, entity_type);

-- Partial index on occurred_at for chronological decision queries
CREATE INDEX IF NOT EXISTS kg_nodes_temporal_occurred_at_idx
  ON kg_nodes ((temporal_metadata->>'occurred_at'))
  WHERE entity_type = 'decision';
