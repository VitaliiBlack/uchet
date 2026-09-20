import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDataSource } from '@/lib/typeorm';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/validation';

export const ADMIN_COOKIE = 'uchet_admin';
const DEFAULT_TTL_HOURS = 8;
const ADMIN_LOGIN_LIMIT = 5;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Compared against for unknown emails so admin login timing is constant.
const DUMMY_PASSWORD_HASH = '$2b$10$L93hoAEkpcaBPDKnDBRJn.OxUDUiHimvPLMzJ8XXX.s9DvOfSNtWS';

export interface AdminSession {
  adminId: number;
  ip: string;
}

/** The secret URL segment for the admin area (from env), or null when unset. */
export const getAdminSlug = (): string | null => {
  const raw = process.env.ADMIN_PATH?.trim();
  if (!raw) {
    return null;
  }
  const slug = raw.replace(/^\/+|\/+$/g, '');
  return slug.length > 0 ? slug : null;
};

const getSecret = (): string | null => {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
};

const sessionTtlMs = (): number => {
  const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? DEFAULT_TTL_HOURS);
  const safe = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_TTL_HOURS;
  return safe * 60 * 60 * 1000;
};

const base64url = (value: Buffer): string => value.toString('base64url');

/** Signed, stateless admin token: <payload>.<hmac>. Null when misconfigured. */
export const signAdminToken = (adminId: number): string | null => {
  const secret = getSecret();
  if (!secret) {
    return null;
  }
  const payload = base64url(
    Buffer.from(JSON.stringify({ sub: adminId, exp: Date.now() + sessionTtlMs() }), 'utf8')
  );
  const signature = base64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return payload + '.' + signature;
};

export const verifyAdminToken = (token: string | null | undefined): { adminId: number } | null => {
  const secret = getSecret();
  if (!secret || !token) {
    return null;
  }
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return null;
  }
  const expected = base64url(crypto.createHmac('sha256', secret).update(payload).digest());
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (
      typeof data.sub !== 'number' ||
      typeof data.exp !== 'number' ||
      Date.now() > data.exp
    ) {
      return null;
    }
    return { adminId: data.sub };
  } catch {
    return null;
  }
};

const ipv4ToLong = (ip: string): number | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      return null;
    }
    value = value * 256 + n;
  }
  return value >>> 0;
};

/** Normalizes an IP so ::ffff:127.0.0.1 matches 127.0.0.1 rules. */
const normalizeIp = (ip: string): string => {
  const trimmed = ip.trim();
  return trimmed.toLowerCase().startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
};

export const isAdminIpAllowed = (rawIp: string): boolean => {
  const allowlist = process.env.ADMIN_IP_ALLOWLIST?.trim();
  if (!allowlist) {
    return true; // unset -> no IP restriction (dev default)
  }
  const ip = normalizeIp(rawIp);
  return allowlist
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => {
      if (!entry.includes('/')) {
        return normalizeIp(entry) === ip;
      }
      const [network, bitsRaw] = entry.split('/');
      const bits = Number(bitsRaw);
      const ipLong = ipv4ToLong(ip);
      const netLong = ipv4ToLong(normalizeIp(network));
      if (ipLong === null || netLong === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
        return false;
      }
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (ipLong & mask) === (netLong & mask);
    });
};

const readCookie = (request: Request, name: string): string | null => {
  const header = request.headers.get('cookie');
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
};

/** Valid admin session for this request (signature + expiry + IP allowlist). */
export const getAdminSession = (request: Request): AdminSession | null => {
  const token = readCookie(request, ADMIN_COOKIE);
  const verified = verifyAdminToken(token);
  if (!verified) {
    return null;
  }
  const ip = clientIp(request);
  if (!isAdminIpAllowed(ip)) {
    return null;
  }
  return { adminId: verified.adminId, ip };
};

export const isActiveAdmin = async (adminId: number): Promise<boolean> => {
  try {
    const dataSource = await getDataSource();
    const rows = await dataSource.query(
      'SELECT id FROM admin_users WHERE id = $1 AND is_active = true LIMIT 1',
      [adminId]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
};

export const buildAdminCookie = (token: string): string => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = Math.floor(sessionTtlMs() / 1000);
  return ADMIN_COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + secure;
};

export const buildClearAdminCookie = (): string => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return ADMIN_COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + secure;
};

export type AdminLoginResult =
  | { ok: true; admin: { id: number; email: string } }
  | { ok: false; reason: 'invalid' | 'disabled' | 'locked' | 'rate_limited' | 'ip_blocked' };

export const verifyAdminCredentials = async (
  request: Request,
  rawEmail: unknown,
  rawPassword: unknown
): Promise<AdminLoginResult> => {
  const ip = clientIp(request);
  if (!isAdminIpAllowed(ip)) {
    return { ok: false, reason: 'ip_blocked' };
  }
  const limit = rateLimit('admin-login:' + ip, ADMIN_LOGIN_LIMIT, ADMIN_LOGIN_WINDOW_MS);
  if (!limit.ok) {
    return { ok: false, reason: 'rate_limited' };
  }

  const email = normalizeEmail(rawEmail);
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  if (!email || !password) {
    return { ok: false, reason: 'invalid' };
  }

  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    'SELECT id, email, password_hash, is_active, locked_until FROM admin_users WHERE lower(email) = $1 LIMIT 1',
    [email]
  );
  const admin = rows[0];

  if (!admin) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH).catch(() => undefined);
    return { ok: false, reason: 'invalid' };
  }
  if (!admin.is_active) {
    return { ok: false, reason: 'disabled' };
  }
  if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
    return { ok: false, reason: 'locked' };
  }

  const valid = admin.password_hash
    ? await bcrypt.compare(password, admin.password_hash)
    : false;

  if (!valid) {
    await dataSource.query(
      'UPDATE admin_users SET failed_attempts = failed_attempts + 1 WHERE id = $1',
      [admin.id]
    );
    return { ok: false, reason: 'invalid' };
  }

  await dataSource.query(
    'UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = $1',
    [admin.id]
  );
  return { ok: true, admin: { id: Number(admin.id), email: String(admin.email) } };
};

export const adminUnauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export const adminNotFound = () =>
  NextResponse.json({ error: 'Not found' }, { status: 404 });
