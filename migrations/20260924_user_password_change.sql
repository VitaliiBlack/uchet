BEGIN;

-- Temporary-password flow: when an admin resets a user's password we flag it,
-- remember when, and the app asks the user to pick their own (grace period 3 days).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS temp_password_set_at TIMESTAMPTZ;

COMMIT;
