-- ATH-71: nango_connections table for tracking provider connections per org
CREATE TABLE nango_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  connection_id   text NOT NULL,
  provider_config_key text NOT NULL,
  display_name    text,
  connected_at    timestamptz NOT NULL DEFAULT now(),
  last_synced_at  timestamptz,
  sync_status     text NOT NULL DEFAULT 'pending',
  UNIQUE(org_id, connection_id, provider_config_key)
);

ALTER TABLE nango_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY nango_connections_read ON nango_connections FOR SELECT
  USING (org_id::text = app_setting('org_id'));

CREATE POLICY nango_connections_admin_write ON nango_connections FOR ALL
  USING (org_id::text = app_setting('org_id') AND app_setting('user_role') = 'admin');
