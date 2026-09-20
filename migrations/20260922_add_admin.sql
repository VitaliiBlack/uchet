BEGIN;

-- Dedicated admin account(s). Fully isolated from the shop "users" table:
-- a compromise of a user row can never escalate into admin access.
CREATE TABLE IF NOT EXISTS admin_users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ
);

-- Security/audit trail: logins, failed logins, logouts, password changes and
-- every admin action. No FK to users so unknown-email failures are kept too.
CREATE TABLE IF NOT EXISTS security_events (
  id         BIGSERIAL PRIMARY KEY,
  type       VARCHAR(40) NOT NULL,
  user_id    INTEGER,
  email      VARCHAR(255),
  ip         VARCHAR(64),
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type       ON security_events (type);
CREATE INDEX IF NOT EXISTS idx_security_events_email      ON security_events (email);

COMMIT;
