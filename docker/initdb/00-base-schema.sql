-- Local development base schema.
-- Base schema for local development. The dated migrations in ./migrations are
-- mounted right after this file and run in order on first init.
-- DEV ONLY: never run this against production.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS financial_operations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  workspace_id INTEGER,
  date DATE NOT NULL,
  income NUMERIC NOT NULL DEFAULT 0,
  expense NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  profit NUMERIC GENERATED ALWAYS AS (income - expense) STORED,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_financial_operations_date ON financial_operations(date);
CREATE INDEX IF NOT EXISTS idx_financial_operations_user_date ON financial_operations(user_id, date);
CREATE INDEX IF NOT EXISTS idx_financial_operations_user_workspace_date ON financial_operations(user_id, workspace_id, date);
CREATE INDEX IF NOT EXISTS idx_workspaces_user_active ON workspaces(user_id, archived_at, id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
