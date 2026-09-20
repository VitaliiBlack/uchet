import bcrypt from 'bcryptjs';
import { ILike } from 'typeorm';
import { getUserRepository } from '@/lib/typeorm';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { logSecurityEvent } from '@/lib/securityEvents';
import { normalizeEmail } from '@/lib/validation';

export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Pre-computed bcrypt hash (cost 10) compared against when the email does not
// exist, so login timing does not reveal whether an account is registered.
const DUMMY_PASSWORD_HASH = '$2b$10$L93hoAEkpcaBPDKnDBRJn.OxUDUiHimvPLMzJ8XXX.s9DvOfSNtWS';

export interface AuthenticatedUser {
  id: number;
  email: string;
  sessionVersion: number;
}

/**
 * Verifies email/password credentials.
 * Returns the user on success, or null on any failure (bad input, unknown
 * user, wrong password, rate-limited, or DB error). Never throws.
 */
export const verifyCredentials = async (
  rawEmail: unknown,
  rawPassword: unknown,
  request?: Request
): Promise<AuthenticatedUser | null> => {
  const email = normalizeEmail(rawEmail);
  const password = typeof rawPassword === 'string' ? rawPassword : '';
  const ip = request ? clientIp(request) : null;

  if (!email || !password) {
    return null;
  }

  const limit = rateLimit('login:' + email, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limit.ok) {
    console.warn('Login rate limit hit for ' + email);
    await logSecurityEvent({ type: 'login_fail', email, ip, detail: { reason: 'rate_limited' } });
    return null;
  }

  try {
    const userRepository = await getUserRepository();
    const user = await userRepository.findOne({ where: { email: ILike(email) } });

    if (!user) {
      // Constant-time mitigation for user enumeration via response timing.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH).catch(() => undefined);
      await logSecurityEvent({ type: 'login_fail', email, ip, detail: { reason: 'unknown_user' } });
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      await logSecurityEvent({
        type: 'login_fail',
        userId: user.id,
        email: user.email,
        ip,
        detail: { reason: 'bad_password' },
      });
      return null;
    }

    await logSecurityEvent({ type: 'login_ok', userId: user.id, email: user.email, ip });

    return {
      id: user.id,
      email: user.email,
      sessionVersion: user.sessionVersion ?? 0,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
};

/** Current session version for a user, or null when the user no longer exists. */
export const getSessionVersion = async (userId: number): Promise<number | null> => {
  const userRepository = await getUserRepository();
  const user = await userRepository.findOne({
    where: { id: userId },
    select: { id: true, sessionVersion: true },
  });

  return user ? user.sessionVersion ?? 0 : null;
};

/** Invalidates every existing token for the user (used on logout). */
export const bumpSessionVersion = async (userId: number): Promise<void> => {
  if (!Number.isInteger(userId) || userId <= 0) {
    return;
  }

  const userRepository = await getUserRepository();
  await userRepository.increment({ id: userId }, 'sessionVersion', 1);
};
