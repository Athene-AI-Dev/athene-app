-- ============================================================
-- Migration: fix_cross_dept_confidential
--
-- vector_search_cross_dept() lacked a visibility filter, which meant
-- confidential documents (visibility = 'confidential') were returned
-- to any admin or super_user performing a cross-department query.
-- The RLS policy on document_embeddings correctly blocks confidential
-- docs for super_users, but the RPC runs as SECURITY DEFINER and
-- bypasses RLS — so the filter MUST be explicit inside the function.
--
-- Fix: add AND de.visibility != 'confidential' to the WHERE clause.
-- ============================================================

CREATE OR REPLACE FUNCTION vector_search_cross_dept (
  p_embedding vector(768),
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  chunk_id        uuid,
  document_id     uuid,
  content_preview text,
  chunk_index     int,
  source_type     text,
  external_url    text,
  department_id   uuid,
  similarity      float
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
    AND de.visibility != 'confidential'          -- Hard wall: confidential never cross-dept
    AND de.visibility != 'restricted'            -- Hard wall: personal docs never cross-dept
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$;
