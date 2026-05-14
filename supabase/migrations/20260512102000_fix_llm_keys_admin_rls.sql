-- Fix BYOK llm_keys permissions for authenticated admin users.

ALTER TABLE public.llm_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS keys_admin_read ON public.llm_keys;
DROP POLICY IF EXISTS keys_admin_insert ON public.llm_keys;
DROP POLICY IF EXISTS keys_admin_update ON public.llm_keys;
DROP POLICY IF EXISTS keys_admin_delete ON public.llm_keys;
DROP POLICY IF EXISTS keys_admin_write ON public.llm_keys;

CREATE POLICY keys_admin_read
ON public.llm_keys
FOR SELECT
TO authenticated
USING (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
);

CREATE POLICY keys_admin_insert
ON public.llm_keys
FOR INSERT
TO authenticated
WITH CHECK (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
);

CREATE POLICY keys_admin_update
ON public.llm_keys
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

CREATE POLICY keys_admin_delete
ON public.llm_keys
FOR DELETE
TO authenticated
USING (
  org_id::text = public.app_setting('org_id')
  AND public.app_setting('user_role') = 'admin'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.llm_keys TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_llm_key(uuid, text, text, text) TO authenticated;
