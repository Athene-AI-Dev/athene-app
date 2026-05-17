-- Enable RLS on bi_accessible_grants and bi_access_audit.
-- Both tables were created in 0004_bi_grants.sql without RLS policies.

ALTER TABLE bi_accessible_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_access_audit      ENABLE ROW LEVEL SECURITY;

-- ── bi_accessible_grants ────────────────────────────────────────────────────

-- All authenticated org members can view grants for their org.
CREATE POLICY "members_select_bi_grants" ON bi_accessible_grants
  FOR SELECT
  USING (
    org_id IN (
      SELECT o.id
      FROM organizations o
      JOIN org_members m ON m.org_id = o.id
      WHERE m.clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

-- Only org admins may create, update, or delete grants.
CREATE POLICY "admin_manage_bi_grants" ON bi_accessible_grants
  FOR ALL
  USING (
    org_id IN (
      SELECT o.id
      FROM organizations o
      JOIN org_members m ON m.org_id = o.id
      WHERE m.clerk_user_id = (auth.jwt() ->> 'sub')
        AND m.role = 'admin'
    )
  );

-- ── bi_access_audit ─────────────────────────────────────────────────────────

-- Members can view their own audit rows; admins can view all rows in their org.
CREATE POLICY "members_select_own_bi_audit" ON bi_access_audit
  FOR SELECT
  USING (
    user_id IN (
      SELECT m.id FROM org_members m
      WHERE m.clerk_user_id = (auth.jwt() ->> 'sub')
        AND m.org_id = bi_access_audit.org_id
    )
    OR
    org_id IN (
      SELECT o.id
      FROM organizations o
      JOIN org_members m ON m.org_id = o.id
      WHERE m.clerk_user_id = (auth.jwt() ->> 'sub')
        AND m.role = 'admin'
    )
  );

-- Audit rows are written by the service_role only; no authenticated INSERT policy.
