-- ============================================================
-- 20260511120000_comprehensive_blueprint_alignment.sql
-- ============================================================
-- This migration standardizes the database schema to match the
-- "Comprehensive Database Blueprint". It performs "Hardening & Healing"
-- to resolve schema mismatches and legacy inconsistencies.
-- ============================================================

-- 1. Standardize org_members
-- Blueprint: clerk_user_id (RENAME), email (ADDED), display_name (ADDED), org_id (UPGRADE to uuid)
-- Note: Already applied in Migration 001 for this repository.

-- 2. Standardize llm_keys
-- Blueprint: org_id (UPGRADE to uuid)
-- Note: Already applied in Migration 005 for this repository.

-- 3. Standardize grant_access_audit
-- Blueprint: Standardize terminology and columns for Cross-Department BI Access Audit.
DROP TABLE IF EXISTS bi_access_audit;
CREATE TABLE IF NOT EXISTS grant_access_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES org_members(id),
  grant_id        uuid REFERENCES access_grants(id) ON DELETE SET NULL,
  scope_used      text NOT NULL,             -- department name or id
  document_ids    text[] NOT NULL,           -- chunks or docs accessed
  query_hash      text,                      -- for auditing similar queries
  accessed_at     timestamptz NOT NULL DEFAULT now()
);

-- 4. Final Verified RPC Signatures
-- Standardize vector search and LLM key management as per Blueprint section 5.

-- vector_search (renamed from match_documents)
CREATE OR REPLACE FUNCTION vector_search (
  p_embedding vector(1536),
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  chunk_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id AS chunk_id,
    1 - (de.embedding <=> p_embedding) AS similarity
  FROM document_embeddings de
  WHERE (de.org_id::text = app_setting('org_id'))
    AND (
      de.visibility = 'org_wide'
      OR de.department_id::text = app_setting('department_id')
    )
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

-- vector_search_cross_dept (Admin/SuperUser only)
CREATE OR REPLACE FUNCTION vector_search_cross_dept (
  p_embedding vector(1536),
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  chunk_id uuid,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security: verify role in app context
  IF app_setting('user_role') NOT IN ('admin', 'super_user') THEN
    RAISE EXCEPTION 'Unauthorized: Requires admin or super_user role';
  END IF;

  RETURN QUERY
  SELECT
    de.id AS chunk_id,
    1 - (de.embedding <=> p_embedding) AS similarity
  FROM document_embeddings de
  WHERE de.org_id::text = app_setting('org_id')
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

-- store_llm_key (standardized signature)
CREATE OR REPLACE FUNCTION store_llm_key(
  p_org_id uuid,
  p_provider text,
  p_plaintext text,
  p_kms_key text
)
RETURNS void AS $$
BEGIN
  INSERT INTO llm_keys (
    org_id,
    provider,
    key_encrypted,
    key_hint,
    created_by
  )
  VALUES (
    p_org_id,
    p_provider,
    pgp_sym_encrypt(p_plaintext, p_kms_key),
    right(p_plaintext, 4),
    (SELECT id FROM org_members WHERE org_id = p_org_id AND clerk_user_id = app_setting('user_id'))
  )
  ON CONFLICT (org_id, provider) WHERE is_active = true
  DO UPDATE SET
    key_encrypted = EXCLUDED.key_encrypted,
    key_hint = EXCLUDED.key_hint,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_decrypted_llm_key (standardized signature)
-- Blueprint: Arguments: p_org_id (uuid), p_kms_key (text)
-- Returns: TABLE (provider text, plaintext text)
DROP FUNCTION IF EXISTS get_decrypted_llm_key(uuid, text);
CREATE OR REPLACE FUNCTION get_decrypted_llm_key(
  p_org_id uuid,
  p_kms_key text
)
RETURNS TABLE (
  provider text,
  plaintext text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lk.provider,
    pgp_sym_decrypt(lk.key_encrypted, p_kms_key) AS plaintext
  FROM llm_keys lk
  WHERE lk.org_id = p_org_id 
    AND lk.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 5. Hardening Triggers
-- Blueprint Section 3: Maintenance & Triggers
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Access Control Cleanup
GRANT EXECUTE ON FUNCTION vector_search(vector, int) TO authenticated;
GRANT EXECUTE ON FUNCTION vector_search_cross_dept(vector, int) TO authenticated;
GRANT EXECUTE ON FUNCTION store_llm_key(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_llm_key(uuid, text) TO service_role;
