CREATE TABLE IF NOT EXISTS crm_users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password text NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  state jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS crm_memberships (
  workspace_id text REFERENCES crm_workspaces(id) ON DELETE CASCADE,
  user_id text REFERENCES crm_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS crm_sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_sessions_expiry ON crm_sessions(expires_at);
CREATE TABLE IF NOT EXISTS crm_invites (
  token text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES crm_workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','member','viewer')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS crm_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_rate_expiry ON crm_rate_limits(expires_at);
CREATE TABLE IF NOT EXISTS crm_provider_events (
  provider text NOT NULL,
  id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,id)
);
CREATE TABLE IF NOT EXISTS crm_public_links (
  token text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES crm_workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('capture','proposal','inbound')),
  record_id text NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_public_workspace ON crm_public_links(workspace_id);
CREATE TABLE IF NOT EXISTS crm_google_connections (
  workspace_id text PRIMARY KEY REFERENCES crm_workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  tokens text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  calendar_name text NOT NULL DEFAULT 'Primary calendar',
  calendar_timezone text NOT NULL DEFAULT 'UTC',
  sync_token text,
  last_sync timestamptz,
  sync_until timestamptz,
  connection_id text NOT NULL,
  issue text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS crm_google_oauth (
  token text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES crm_workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_google_oauth_expiry ON crm_google_oauth(expires_at);

ALTER TABLE crm_google_connections ADD COLUMN IF NOT EXISTS sync_query jsonb;
ALTER TABLE crm_google_connections ADD COLUMN IF NOT EXISTS sync_seen jsonb;
ALTER TABLE crm_google_connections ADD COLUMN IF NOT EXISTS full_sync_at timestamptz;

CREATE TABLE IF NOT EXISTS crm_provider_bindings (
  provider text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES crm_workspaces(id) ON DELETE CASCADE
);
INSERT INTO crm_provider_bindings(provider,workspace_id)
SELECT 'primary', min(id) FROM crm_workspaces HAVING count(*)=1
ON CONFLICT DO NOTHING;
