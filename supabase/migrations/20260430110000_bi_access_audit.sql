-- ==========================================
-- ATH-35: Cross-Department BI Access Audit
-- ==========================================

CREATE TABLE IF NOT EXISTS bi_access_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  query       text NOT NULL,
  dept        text, -- department_id or name
  doc_id      text, -- chunk_id or document_id
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for analytics performance
CREATE INDEX IF NOT EXISTS idx_bi_audit_org ON bi_access_audit(org_id);
CREATE INDEX IF NOT EXISTS idx_bi_audit_user ON bi_access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_bi_audit_created ON bi_access_audit(created_at);

-- RLS
ALTER TABLE bi_access_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs for their org
CREATE POLICY "Admins can view org BI audit logs"
  ON bi_access_audit
  FOR SELECT
  TO authenticated
  USING (
    org_id::text = (auth.jwt() -> 'user_metadata' ->> 'org_id')
    -- AND role check would go here if role was in JWT, but we usually check in app layer or via app_settings
  );

-- Only service role or app logic with bypass can insert (or we allow authenticated if we trust the node)
CREATE POLICY "Allow authenticated insert for audit"
  ON bi_access_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
