-- Fix automations permissions for authenticated admin users.

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automations_admin_read ON public.automations;
DROP POLICY IF EXISTS automations_admin_insert ON public.automations;
DROP POLICY IF EXISTS automations_admin_update ON public.automations;
DROP POLICY IF EXISTS automations_admin_delete ON public.automations;
DROP POLICY IF EXISTS automations_admin ON public.automations;

CREATE POLICY automations_admin_read
ON public.automations
FOR SELECT
TO authenticated
USING (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
);

CREATE POLICY automations_admin_insert
ON public.automations
FOR INSERT
TO authenticated
WITH CHECK (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
);

CREATE POLICY automations_admin_update
ON public.automations
FOR UPDATE
TO authenticated
USING (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
)
WITH CHECK (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
);

CREATE POLICY automations_admin_delete
ON public.automations
FOR DELETE
TO authenticated
USING (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.automations TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
