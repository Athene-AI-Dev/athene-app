-- ============================================================
-- 20260518000000_add_name_to_automations.sql — Add name column to automations (BUG-07 / BUG-16)
-- ============================================================

ALTER TABLE automations ADD COLUMN IF NOT EXISTS name text;
