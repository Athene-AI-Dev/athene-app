-- ============================================================
-- Add missing column referenced by the admin keys API.
-- Safe to run multiple times.
-- ============================================================

ALTER TABLE public.llm_keys
ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

