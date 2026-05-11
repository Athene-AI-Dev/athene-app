-- ============================================================
-- 008_rls_helpers.sql — Helper for setting session context
-- ============================================================

CREATE OR REPLACE FUNCTION set_app_context(
  p_org_id text,
  p_user_id text,
  p_dept_id text DEFAULT '',
  p_role text DEFAULT 'member',
  p_kms_key text DEFAULT ''
)
RETURNS void AS $$
BEGIN
  -- Third arg = true → setting is LOCAL to the current transaction.
  -- Prevents session variable leakage across requests when the
  -- connection pool reuses a connection.
  PERFORM set_config('app.org_id', p_org_id, true);
  PERFORM set_config('app.user_id', p_user_id, true);
  PERFORM set_config('app.department_id', p_dept_id, true);
  PERFORM set_config('app.user_role', p_role, true);
  PERFORM set_config('app.kms_key', p_kms_key, true);
END;
$$ LANGUAGE plpgsql;

-- Ensure service_role can call this
GRANT EXECUTE ON FUNCTION set_app_context(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION set_app_context(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION set_app_context(text, text, text, text, text) TO anon;

-- Standard vector search (Org-scoped)
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
  WHERE de.org_id::text = app_setting('org_id')
    AND (
      de.visibility = 'org_wide'
      OR de.department_id::text = app_setting('department_id')
    )
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

-- Admin vector search (Cross-Department)
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

-- Securely store LLM keys
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

-- Session grants helper (temp table for current transaction)
CREATE OR REPLACE FUNCTION set_session_grants(p_grants jsonb)
RETURNS void AS $$
BEGIN
  CREATE TEMPORARY TABLE IF NOT EXISTS session_grants (
    scope_type grant_scope,
    scope_id text
  ) ON COMMIT DROP;
  
  DELETE FROM session_grants;
  
  INSERT INTO session_grants (scope_type, scope_id)
  SELECT (x->>'scope_type')::grant_scope, x->>'scope_id'
  FROM jsonb_array_elements(p_grants) AS x;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION set_session_grants(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION set_session_grants(jsonb) TO authenticated;

-- GRANT Table permissions (PostgREST requires these for RLS to even trigger)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION vector_search(vector, int) TO authenticated;
GRANT EXECUTE ON FUNCTION vector_search_cross_dept(vector, int) TO authenticated;
GRANT EXECUTE ON FUNCTION store_llm_key(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_decrypted_llm_key(uuid, text) TO service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
