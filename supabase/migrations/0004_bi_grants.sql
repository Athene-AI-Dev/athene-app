CREATE TABLE IF NOT EXISTS bi_accessible_grants (
  grant_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type   text NOT NULL,
  resource_id     uuid NOT NULL,
  granted_by      uuid NOT NULL REFERENCES org_members(id),
  granted_at      timestamptz NOT NULL DEFAULT now()
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
