BEGIN;

-- Additive: per-user session version used to revoke stateless JWTs on logout.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

COMMIT;
