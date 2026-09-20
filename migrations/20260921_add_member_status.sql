BEGIN;

-- Memberships require the invited user's confirmation.
-- Existing rows stay 'accepted' (grandfathered); new invites are 'pending'.
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'accepted';

COMMIT;
