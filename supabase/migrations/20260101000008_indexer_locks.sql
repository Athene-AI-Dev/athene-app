-- ============================================================
-- 008_indexer_locks.sql — Advisory Locks for Indexing
-- ============================================================

/**
 * Acquires a session-level advisory lock for a document.
 * Returns true if the lock was acquired, false if it is already held.
 */
CREATE OR REPLACE FUNCTION acquire_document_lock(p_document_id uuid)
RETURNS boolean AS $$
DECLARE
  v_lock_id bigint;
BEGIN
  -- Generate a 64-bit lock ID from the UUID
  v_lock_id := ('x' || substr(md5(p_document_id::text), 1, 16))::bit(64)::bigint;
  
  -- pg_try_advisory_lock returns true if successful
  RETURN pg_try_advisory_lock(v_lock_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Releases a session-level advisory lock for a document.
 */
CREATE OR REPLACE FUNCTION release_document_lock(p_document_id uuid)
RETURNS void AS $$
DECLARE
  v_lock_id bigint;
BEGIN
  v_lock_id := ('x' || substr(md5(p_document_id::text), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_unlock(v_lock_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
