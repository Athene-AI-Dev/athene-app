-- Sprint 4F: Event sourcing for the knowledge graph
-- Creates kg_events table with causal chain support.
-- Events represent discrete occurrences tied to KG entities:
-- incidents, decisions, escalations, milestones, alerts, changes.
--
-- caused_by_event_id enables causal chain traversal:
--   incident → escalation → customer churn → legal SLA breach
--
-- RLS: org-scoped via app_setting('org_id').

CREATE TABLE IF NOT EXISTS kg_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,

  -- Event classification
  event_type text NOT NULL
    CHECK (event_type IN ('incident', 'decision', 'escalation', 'milestone', 'alert', 'change')),

  -- When the event occurred (may differ from created_at if extracted from historical docs)
  event_time timestamptz NOT NULL,

  -- Human-readable description of what happened
  description text NOT NULL,

  -- Source document that contained this event (for citation)
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,

  -- Causal chain: the event that directly caused this one (nullable)
  caused_by_event_id uuid REFERENCES kg_events(id) ON DELETE SET NULL,

  -- Arbitrary additional context (severity, actors, links, etc.)
  metadata jsonb NOT NULL DEFAULT '{}',

  -- Extraction confidence: 1.0 = explicitly stated, 0.9 = clearly implied
  confidence float NOT NULL DEFAULT 1.0
    CHECK (confidence >= 0.0 AND confidence <= 1.0),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chronological event lookup per entity
CREATE INDEX IF NOT EXISTS kg_events_entity_time_idx
  ON kg_events(entity_id, event_time DESC);

-- Org-wide timeline queries
CREATE INDEX IF NOT EXISTS kg_events_org_time_idx
  ON kg_events(org_id, event_time DESC);

-- Causal chain traversal
CREATE INDEX IF NOT EXISTS kg_events_causal_idx
  ON kg_events(caused_by_event_id)
  WHERE caused_by_event_id IS NOT NULL;

-- Event type filter
CREATE INDEX IF NOT EXISTS kg_events_type_idx
  ON kg_events(org_id, event_type);

-- RLS: same org isolation as other KG tables
ALTER TABLE kg_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY kg_events_org_isolation ON kg_events
  FOR ALL
  USING (org_id = (app_setting('org_id'))::uuid);

COMMENT ON TABLE kg_events IS
  'Discrete events tied to knowledge graph entities. Supports causal chain traversal via caused_by_event_id. Used by the causalChainTool to answer "what happened to X" queries.';
