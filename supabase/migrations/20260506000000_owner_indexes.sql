-- ============================================================
-- 20260506000000_owner_indexes.sql — Standalone indexes for owner_user_id
-- ============================================================
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- Supabase runs migrations in a transaction by default, so we use
-- regular CREATE INDEX here. The lock is brief for new tables.
-- For production tables with heavy traffic, apply these indexes manually
-- via a separate CONCURRENTLY run outside the migration transaction.

-- Documents: standalone index on owner_user_id
CREATE INDEX idx_documents_owner_user_id
  ON documents(owner_user_id);

-- Document Embeddings: standalone index on owner_user_id
CREATE INDEX idx_embeddings_owner_user_id
  ON document_embeddings(owner_user_id);

-- Standalone index on org_members.clerk_user_id without org_id
-- for lookups that only have the Clerk user ID (e.g., auth flows)
CREATE INDEX idx_org_members_clerk_user_only
  ON org_members(clerk_user_id);
