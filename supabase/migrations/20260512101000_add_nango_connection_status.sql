-- ============================================================
-- Add sync status fields to nango_connections.
-- lib/nango/client.ts expects these columns for integrations UI.
-- Safe to run multiple times.
-- ============================================================

ALTER TABLE public.nango_connections
ADD COLUMN IF NOT EXISTS sync_status text,
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

