-- ============================================================
-- 20260512000000_perf_indexes.sql — Performance-critical indexes
-- ============================================================
-- ATH-PERF: Adds missing indexes identified in the May 2026
-- performance audit. These directly affect p95 vector search
-- and dashboard TTFB targets.
-- ============================================================

-- documents.user_id — was missing; used by owner-based RLS policies
-- and dashboard "my documents" queries. Without this, Postgres falls
-- back to seq-scan on documents for per-user queries.
CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON documents(owner_user_id);

-- Composite index for thread listing: user + org + recency.
-- Supports the cached recent-threads query in /api/threads.
CREATE INDEX IF NOT EXISTS idx_threads_user_recent
  ON threads(user_id, org_id, updated_at DESC);

-- org_members lookup by clerk_user_id + org_id (used on every request
-- for member resolution). The existing idx_org_members_clerk_user is
-- on clerk_user_id alone, missing org_id for the composite filter.
CREATE INDEX IF NOT EXISTS idx_org_members_clerk_user_org
  ON org_members(clerk_user_id, org_id);
