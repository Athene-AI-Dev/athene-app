-- ============================================================
-- Migration: fix_vector_search_rpc
--
-- Both vector_search() and vector_search_cross_dept() currently
-- return only (chunk_id, similarity). The retrieval agent and
-- report agent both need document_id, full chunk text, chunk_index,
-- source_type, external_url, and department_id to build citations
-- and populate the synthesis context window.
--
-- Full chunk text is stored at index-time in
--   document_embeddings.metadata->>'chunk_text'
-- with content_preview as the 200-char fallback.
-- ============================================================

-- ---- vector_search: standard org-scoped search ---------------

CREATE OR REPLACE FUNCTION vector_search (
  p_embedding vector(768),
  p_limit     int DEFAULT 10
)
RETURNS TABLE (
  chunk_id      uuid,
  document_id   uuid,
  content_preview text,
  chunk_index   int,
  source_type   text,
  external_url  text,
  department_id uuid,
  similarity    float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id                                                              AS chunk_id,
    de.document_id                                                     AS document_id,
    COALESCE(de.metadata->>'chunk_text', de.content_preview, '')::text AS content_preview,
    de.chunk_index                                                     AS chunk_index,
    COALESCE(de.source_type, d.source_type, 'unknown')::text          AS source_type,
    d.external_url::text                                               AS external_url,
    de.department_id                                                   AS department_id,
    (1 - (de.embedding <=> p_embedding))::float                       AS similarity
  FROM document_embeddings de
  LEFT JOIN documents d ON d.id = de.document_id
  WHERE de.org_id::text = app_setting('org_id')
    AND (
      de.visibility = 'org_wide'
      OR de.department_id::text = app_setting('department_id')
    )
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

-- ---- vector_search_cross_dept: admin / super_user only -------

CREATE OR REPLACE FUNCTION vector_search_cross_dept (
  p_embedding vector(768),
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  chunk_id      uuid,
  document_id   uuid,
  content_preview text,
  chunk_index   int,
  source_type   text,
  external_url  text,
  department_id uuid,
  similarity    float
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
    de.id                                                              AS chunk_id,
    de.document_id                                                     AS document_id,
    COALESCE(de.metadata->>'chunk_text', de.content_preview, '')::text AS content_preview,
    de.chunk_index                                                     AS chunk_index,
    COALESCE(de.source_type, d.source_type, 'unknown')::text          AS source_type,
    d.external_url::text                                               AS external_url,
    de.department_id                                                   AS department_id,
    (1 - (de.embedding <=> p_embedding))::float                       AS similarity
  FROM document_embeddings de
  LEFT JOIN documents d ON d.id = de.document_id
  WHERE de.org_id::text = app_setting('org_id')
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION vector_search(vector, int)            TO authenticated;
GRANT EXECUTE ON FUNCTION vector_search_cross_dept(vector, int) TO authenticated;
