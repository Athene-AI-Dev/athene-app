CREATE TABLE IF NOT EXISTS nango_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  provider_config_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, connection_id, provider_config_key)
);

-- Enable RLS
ALTER TABLE nango_connections ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON nango_connections
  USING (true)
  WITH CHECK (true);
