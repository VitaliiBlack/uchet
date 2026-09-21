import bcrypt from 'bcryptjs';
import pg from 'pg';
import { readFileSync } from 'node:fs';

const readDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const text = readFileSync(new URL('../.env.development.local', import.meta.url), 'utf8');
    const match = text.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

const url = readDatabaseUrl();
const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? '';

if (!url) {
  console.error('DATABASE_URL not found (env or .env.development.local)');
  process.exit(1);
}
if (!email || !password) {
  console.error('Usage: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... node scripts/create-admin.mjs');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO admin_users (email, password_hash, must_change_password)
       VALUES ($1, $2, true)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             is_active = true,
             failed_attempts = 0,
             locked_until = NULL
     RETURNING id, email`,
    [email, hash]
  );
  console.log('Admin ready: #' + result.rows[0].id + ' ' + result.rows[0].email);
} finally {
  await pool.end();
}
