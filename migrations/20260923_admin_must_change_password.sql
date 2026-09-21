BEGIN;

-- Force a credential change after the bootstrap admin is provisioned, so the
-- placeholder login/password can never stay in production.
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMIT;
