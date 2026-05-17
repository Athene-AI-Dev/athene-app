CREATE TABLE IF NOT EXISTS bi_accessible_grants (
  grant_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   text NOT NULL CHECK (resource_type IN ('document','folder','department')), -- Constraint added (ATH-47 #9)
  resource_id     uuid NOT NULL,
  granted_by      uuid REFERENCES org_members(id) ON DELETE SET NULL, -- FK behavior fix (ATH-47 #7)
  granted_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, resource_type, resource_id) -- Duplicate prevention (ATH-47 #8)
);

-- Note: The instruction mentions bi_access_audit is already written. 
-- Adding it here just in case it was missing from the local environment, 
-- but wrapped in IF NOT EXISTS to prevent conflicts if it's indeed already there.
CREATE TABLE IF NOT EXISTS bi_access_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES org_members(id),
  query           text NOT NULL,
  dept            uuid,
  doc_id          uuid,
  timestamp       timestamptz NOT NULL DEFAULT now()
);
