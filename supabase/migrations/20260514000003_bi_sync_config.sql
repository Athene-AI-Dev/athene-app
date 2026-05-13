-- ============================================================
-- Migration: bi_sync_config
--
-- Adds sync_config to the connections table so each connection
-- can carry its own ingestion settings (row limits, stats,
-- aggregations, incremental mode).
--
-- sync_cursor already exists in the schema (20260101000001_schema.sql)
-- but was never populated by application code. This migration adds
-- a comment documenting its intended use as a delta watermark.
-- ============================================================

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS sync_config jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN connections.sync_config IS
  'Per-connection ingestion settings. Shape: '
  '{ max_rows_per_table: int, sample_rows: int, enable_stats: bool, '
  'enable_aggregations: bool, stats_categorical_limit: int, incremental: bool }. '
  'Absent or null keys fall back to application defaults.';

COMMENT ON COLUMN connections.sync_cursor IS
  'Provider-specific delta watermark written after each successful sync. '
  'Shape varies per provider. Example for SQL connectors: '
  '{ synced_at: ISO8601, table_max_ids: { "SCHEMA.TABLE": lastMaxId } }';
