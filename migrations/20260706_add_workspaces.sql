BEGIN;

CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_operations
  ADD COLUMN IF NOT EXISTS workspace_id INTEGER;

INSERT INTO workspaces (user_id, name)
SELECT u.id, 'Магазин 1'
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM workspaces w
  WHERE w.user_id = u.id
);

UPDATE financial_operations fo
SET workspace_id = w.id
FROM workspaces w
WHERE fo.user_id = w.user_id
  AND fo.workspace_id IS NULL
  AND w.archived_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM financial_operations
    WHERE workspace_id IS NULL
  ) THEN
    RAISE EXCEPTION 'workspace_id backfill failed: NULL values remain';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_operations_workspace_id_fkey'
  ) THEN
    ALTER TABLE financial_operations
      ADD CONSTRAINT financial_operations_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspaces_user_active
  ON workspaces(user_id, archived_at, id);

CREATE INDEX IF NOT EXISTS idx_financial_operations_user_workspace_date
  ON financial_operations(user_id, workspace_id, date);

-- Keep this final constraint until the new code is deployed everywhere.
-- ALTER TABLE financial_operations ALTER COLUMN workspace_id SET NOT NULL;

COMMIT;
