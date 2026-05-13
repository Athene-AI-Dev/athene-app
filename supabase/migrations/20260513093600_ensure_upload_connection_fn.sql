-- Ensures a "direct_upload" connection exists for the given org.
-- Runs in a single transaction to avoid FK constraint issues
-- between the org lookup and the connection insert.

CREATE OR REPLACE FUNCTION public.ensure_upload_connection(p_clerk_org_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_conn_id uuid;
BEGIN
  -- 1. Resolve org
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE clerk_org_id = p_clerk_org_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization not found for clerk_org_id: %', p_clerk_org_id;
  END IF;

  -- 2. Find or create the direct_upload connection
  SELECT id INTO v_conn_id
  FROM public.connections
  WHERE org_id = v_org_id
    AND provider = 'direct_upload';

  IF v_conn_id IS NULL THEN
    INSERT INTO public.connections (org_id, nango_connection_id, provider, source_type, scope, status)
    VALUES (v_org_id, 'direct_upload', 'direct_upload', 'direct_upload', 'org', 'active')
    RETURNING id INTO v_conn_id;
  END IF;

  RETURN jsonb_build_object('org_id', v_org_id, 'connection_id', v_conn_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_upload_connection(text) TO service_role;
