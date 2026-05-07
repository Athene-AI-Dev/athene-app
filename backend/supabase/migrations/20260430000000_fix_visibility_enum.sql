-- ============================================================
-- fix_visibility_enum.sql — Align visibility levels with ATH-58/59
-- ============================================================

-- 1. Add new enum values to visibility_level
-- Note: Postgres doesn't allow removing enum values in a single transaction easily.
-- We add 'team' and 'public' and 'private' (if missing).
-- Existing: 'org_wide', 'department', 'bi_accessible', 'confidential', 'restricted'

ALTER TYPE visibility_level ADD VALUE IF NOT EXISTS 'public';
ALTER TYPE visibility_level ADD VALUE IF NOT EXISTS 'team';
ALTER TYPE visibility_level ADD VALUE IF NOT EXISTS 'private';

-- 2. Update existing data to use new values
-- Mapping:
--   org_wide      -> public
--   department    -> team
--   restricted    -> private
--   confidential  -> private (safest fallback)
--   bi_accessible -> team    (safest fallback)

UPDATE documents SET visibility = 'public' WHERE visibility = 'org_wide';
UPDATE documents SET visibility = 'team' WHERE visibility = 'department';
UPDATE documents SET visibility = 'private' WHERE visibility = 'restricted';
UPDATE documents SET visibility = 'private' WHERE visibility = 'confidential';
UPDATE documents SET visibility = 'team' WHERE visibility = 'bi_accessible';

UPDATE document_embeddings SET visibility = 'public' WHERE visibility = 'org_wide';
UPDATE document_embeddings SET visibility = 'team' WHERE visibility = 'department';
UPDATE document_embeddings SET visibility = 'private' WHERE visibility = 'restricted';
UPDATE document_embeddings SET visibility = 'private' WHERE visibility = 'confidential';
UPDATE document_embeddings SET visibility = 'team' WHERE visibility = 'bi_accessible';

UPDATE kg_nodes SET visibility = 'public' WHERE visibility = 'org_wide';
UPDATE kg_nodes SET visibility = 'team' WHERE visibility = 'department';
UPDATE kg_nodes SET visibility = 'private' WHERE visibility = 'restricted';
UPDATE kg_nodes SET visibility = 'private' WHERE visibility = 'confidential';
UPDATE kg_nodes SET visibility = 'team' WHERE visibility = 'bi_accessible';

UPDATE kg_edges SET visibility = 'public' WHERE visibility = 'org_wide';
UPDATE kg_edges SET visibility = 'team' WHERE visibility = 'department';
UPDATE kg_edges SET visibility = 'private' WHERE visibility = 'restricted';
UPDATE kg_edges SET visibility = 'private' WHERE visibility = 'confidential';
UPDATE kg_edges SET visibility = 'team' WHERE visibility = 'bi_accessible';

-- 3. Update RLS Policies to use new values
-- We need to DROP and RE-CREATE the policies that mention the old values.

-- documents
DROP POLICY IF EXISTS documents_read ON documents;
CREATE POLICY documents_read ON documents FOR SELECT
  USING (
    org_id::text = app_setting('org_id')
    AND (
      app_setting('user_role') = 'admin'
      OR visibility = 'public'
      OR (department_id::text = app_setting('department_id') AND visibility = 'team')
      OR (visibility = 'private' AND owner_user_id::text = app_setting('user_id'))
    )
  );

-- document_embeddings
DROP POLICY IF EXISTS embeddings_read ON document_embeddings;
CREATE POLICY embeddings_read ON document_embeddings FOR SELECT
  USING (
    org_id::text = app_setting('org_id')
    AND (
      app_setting('user_role') = 'admin'
      OR visibility = 'public'
      OR (department_id::text = app_setting('department_id') AND visibility = 'team')
      OR (visibility = 'private' AND owner_user_id::text = app_setting('user_id'))
    )
  );

-- kg_nodes
DROP POLICY IF EXISTS kg_nodes_read ON kg_nodes;
CREATE POLICY kg_nodes_read ON kg_nodes FOR SELECT
  USING (
    org_id::text = app_setting('org_id')
    AND (
      app_setting('user_role') = 'admin'
      OR visibility = 'public'
      OR (app_setting('department_id')::uuid = ANY(department_ids) AND visibility = 'team')
    )
  );

-- kg_edges
DROP POLICY IF EXISTS kg_edges_read ON kg_edges;
CREATE POLICY kg_edges_read ON kg_edges FOR SELECT
  USING (
    org_id::text = app_setting('org_id')
    AND (
      app_setting('user_role') = 'admin'
      OR visibility = 'public'
      OR (department_id::text = app_setting('department_id') AND visibility = 'team')
    )
  );
