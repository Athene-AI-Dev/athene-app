-- ============================================================
-- Migration: embedding_provider_config
--
-- 1. Change document_embeddings.embedding from vector(1536) → vector(768)
--    to match nomic-embed-text-v1.5 / jina-embeddings-v3 output dims.
--    OpenAI BYOK orgs use text-embedding-3-small with dimensions:768 (MRL).
--
-- 2. Recreate HNSW index for new dimension.
--
-- 3. Update vector_search() and vector_search_cross_dept() RPC signatures.
--
-- 4. Extend llm_keys.provider CHECK to include deepseek + embedding providers.
-- ============================================================

-- ---- 1. Update embedding column dimension --------------------------------

ALTER TABLE document_embeddings DROP COLUMN embedding;
ALTER TABLE document_embeddings ADD COLUMN embedding vector(768) NOT NULL;

-- ---- 2. Recreate HNSW index ----------------------------------------------

DROP INDEX IF EXISTS idx_doc_embeddings_hnsw;
CREATE INDEX idx_doc_embeddings_hnsw
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- ---- 3a. Update standard vector_search RPC --------------------------------

CREATE OR REPLACE FUNCTION vector_search (
  p_embedding vector(768),
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

-- ---- 3b. Update cross-dept vector_search RPC ------------------------------

CREATE OR REPLACE FUNCTION vector_search_cross_dept (
  p_embedding vector(768),
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

GRANT EXECUTE ON FUNCTION vector_search(vector, int) TO authenticated;
GRANT EXECUTE ON FUNCTION vector_search_cross_dept(vector, int) TO authenticated;

-- ---- 4. Extend BYOK provider constraint -----------------------------------

ALTER TABLE llm_keys DROP CONSTRAINT IF EXISTS llm_keys_provider_check;
ALTER TABLE llm_keys ADD CONSTRAINT llm_keys_provider_check
  CHECK (provider IN ('anthropic', 'openai', 'google', 'deepseek', 'jina', 'nomic'));
