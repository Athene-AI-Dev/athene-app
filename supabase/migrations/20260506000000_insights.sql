-- ATH-53: BI Insights table
-- Stores saved insight cards with their query, result and metadata.

CREATE TABLE IF NOT EXISTS public.insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES public.org_members(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  query         TEXT NOT NULL,
  result        JSONB NOT NULL DEFAULT '{}',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only members of the org can see its insights
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Admin/super_user can do everything within their org
CREATE POLICY "insights_admin_all" ON public.insights
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE clerk_user_id = auth.uid()::text
        AND role IN ('admin', 'super_user')
    )
  );

-- Any org member can read insights for their org
CREATE POLICY "insights_member_read" ON public.insights
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE clerk_user_id = auth.uid()::text
    )
  );

-- Performance index
CREATE INDEX IF NOT EXISTS insights_org_id_sort ON public.insights (org_id, sort_order ASC);
