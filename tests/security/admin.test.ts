import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

process.env.ADMIN_PATH = 'panel-test';
process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-1234567890';
process.env.ADMIN_IP_ALLOWLIST = '';

import { POST as login } from '@/app/[adminSlug]/api/login/route';
import { POST as logout } from '@/app/[adminSlug]/api/logout/route';
import { GET as me } from '@/app/[adminSlug]/api/me/route';
import { GET as stats } from '@/app/[adminSlug]/api/stats/route';
import { GET as users } from '@/app/[adminSlug]/api/users/route';
import { POST as userAction } from '@/app/[adminSlug]/api/users/[id]/route';
import { resetRateLimits } from '@/lib/rateLimit';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });
const req = (url: string, method = 'GET', body?: unknown, ip = '10.1.1.1') =>
  new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const ADMIN_EMAIL = 'admin@test.dev';
const ADMIN_PASSWORD = 'AdminPass123!';
const SLUG = 'panel-test';

const seed = async () => {
  await pool.query('TRUNCATE security_events RESTART IDENTITY');
  await pool.query('TRUNCATE admin_users RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE financial_operations, workspace_members, workspaces, users RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 4);
  await pool.query(
    "INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)",
    [ADMIN_EMAIL, hash]
  );
  await pool.query(
    "INSERT INTO users (email, password, session_version) VALUES ('user1@test.dev','x',0),('user2@test.dev','x',0)"
  );
};

const cookieFrom = (res: Response): string => {
  const header = res.headers.get('set-cookie') ?? '';
  return header.split(';')[0];
};

const loginOk = async (ip = '10.1.1.1'): Promise<string> => {
  const res = await login(
    req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ip),
    ctx({ adminSlug: SLUG })
  );
  expect(res.status).toBe(200);
  return cookieFrom(res);
};

describe('admin panel: isolated auth & data', () => {
  beforeEach(async () => {
    resetRateLimits();
    await seed();
  });
  afterAll(async () => {
    await pool.end();
  });

  it('rejects a wrong secret slug on every admin route', async () => {
    const l = await login(
      req('http://x/nope/api/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      ctx({ adminSlug: 'nope' })
    );
    expect(l.status).toBe(404);
    const s = await stats(req('http://x/nope/api/stats'), ctx({ adminSlug: 'nope' }));
    expect(s.status).toBe(404);
  });

  it('requires a session for every admin data route', async () => {
    for (const res of [
      await me(req('http://x/' + SLUG + '/api/me'), ctx({ adminSlug: SLUG })),
      await stats(req('http://x/' + SLUG + '/api/stats'), ctx({ adminSlug: SLUG })),
      await users(req('http://x/' + SLUG + '/api/users'), ctx({ adminSlug: SLUG })),
    ]) {
      expect(res.status).toBe(401);
    }
  });

  it('login sets an HttpOnly, SameSite=Strict cookie; wrong password is 401', async () => {
    const bad = await login(
      req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: 'wrong' }),
      ctx({ adminSlug: SLUG })
    );
    expect(bad.status).toBe(401);

    const res = await login(
      req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      ctx({ adminSlug: SLUG })
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('accepts a valid cookie, rejects a tampered one', async () => {
    const cookie = await loginOk();
    const ok = await stats(req('http://x/' + SLUG + '/api/stats'), ctx({ adminSlug: SLUG }));
    expect(ok.status).toBe(401); // no cookie sent (headers built per request below)

    const withCookie = await stats(
      new Request('http://x/' + SLUG + '/api/stats', { headers: { cookie } }),
      ctx({ adminSlug: SLUG })
    );
    expect(withCookie.status).toBe(200);

    const tampered = cookie.slice(0, -2) + (cookie.endsWith('a') ? 'bb' : 'aa');
    const denied = await stats(
      new Request('http://x/' + SLUG + '/api/stats', { headers: { cookie: tampered } }),
      ctx({ adminSlug: SLUG })
    );
    expect(denied.status).toBe(401);
  });

  it('enforces the IP allowlist on login and on session use', async () => {
    const before = process.env.ADMIN_IP_ALLOWLIST;
    process.env.ADMIN_IP_ALLOWLIST = '10.9.9.0/24';
    try {
      const blocked = await login(
        req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, '10.1.1.1'),
        ctx({ adminSlug: SLUG })
      );
      expect(blocked.status).toBe(401);

      const allowed = await login(
        req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, '10.9.9.7'),
        ctx({ adminSlug: SLUG })
      );
      expect(allowed.status).toBe(200);
    } finally {
      process.env.ADMIN_IP_ALLOWLIST = before;
    }
    resetRateLimits();
  });

  it('rate-limits repeated admin login failures', async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const res = await login(
        req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: 'wrong' }),
        ctx({ adminSlug: SLUG })
      );
      last = res.status;
    }
    expect(last).toBe(401);
    // even the correct password is now throttled for this IP
    const throttled = await login(
      req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      ctx({ adminSlug: SLUG })
    );
    expect(throttled.status).toBe(401);
  });

  it('password reset bumps session_version (revokes user sessions)', async () => {
    const cookie = await loginOk();
    const before = (await pool.query('SELECT session_version FROM users WHERE id = 1')).rows[0].session_version;

    const res = await userAction(
      new Request('http://x/' + SLUG + '/api/users/1', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'reset-password', password: 'BrandNewPass1' }),
      }),
      ctx({ adminSlug: SLUG, id: '1' })
    );
    expect(res.status).toBe(200);
    const after = (await pool.query('SELECT session_version, password FROM users WHERE id = 1')).rows[0];
    expect(Number(after.session_version)).toBe(Number(before) + 1);
    const check = await bcrypt.compare('BrandNewPass1', after.password);
    expect(check).toBe(true);
  });

  it('change-email works and rejects duplicates', async () => {
    const cookie = await loginOk();
    const ok = await userAction(
      new Request('http://x/' + SLUG + '/api/users/1', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'change-email', email: 'renamed@test.dev' }),
      }),
      ctx({ adminSlug: SLUG, id: '1' })
    );
    expect(ok.status).toBe(200);

    const dup = await userAction(
      new Request('http://x/' + SLUG + '/api/users/1', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ action: 'change-email', email: 'user2@test.dev' }),
      }),
      ctx({ adminSlug: SLUG, id: '1' })
    );
    expect(dup.status).toBe(409);
  });

  it('user listing never exposes password hashes', async () => {
    const cookie = await loginOk();
    const res = await users(
      new Request('http://x/' + SLUG + '/api/users', { headers: { cookie } }),
      ctx({ adminSlug: SLUG })
    );
    const text = await res.text();
    expect(text).toContain('user1@test.dev');
    expect(text).not.toContain('password');
    expect(text).not.toContain('$2b$');
  });

  it('records login outcomes in the audit trail', async () => {
    await login(
      req('http://x/' + SLUG + '/api/login', 'POST', { email: ADMIN_EMAIL, password: 'wrong' }),
      ctx({ adminSlug: SLUG })
    );
    await loginOk();
    const rows = await pool.query('SELECT type FROM security_events ORDER BY id');
    const types = rows.rows.map((r) => r.type);
    expect(types).toContain('admin_login_fail');
    expect(types).toContain('admin_login_ok');
  });

  it('logout clears the cookie', async () => {
    const cookie = await loginOk();
    const res = await logout(
      new Request('http://x/' + SLUG + '/api/logout', { method: 'POST', headers: { cookie } }),
      ctx({ adminSlug: SLUG })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=0');
  });
});
