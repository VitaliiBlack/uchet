import bcrypt from 'bcryptjs';
import { ILike } from 'typeorm';
import { getUserRepository } from '@/lib/typeorm';
import { rateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/validation';

export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface AuthenticatedUser {
  id: number;
  email: string;
}

/**
 * Verifies email/password credentials.
 * Returns the user on success, or null on any failure (bad input, unknown
 * user, wrong password, rate-limited, or DB error). Never throws.
 */
export const verifyCredentials = async (
  rawEmail: unknown,
  rawPassword: unknown
): Promise<AuthenticatedUser | null> => {
  const email = normalizeEmail(rawEmail);
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  if (!email || !password) {
    return null;
  }

  // Per-account brute-force throttle (best-effort, in-memory).
  const limit = rateLimit('login:' + email, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limit.ok) {
    console.warn('Login rate limit hit for ' + email);
    return null;
  }

  try {
    const userRepository = await getUserRepository();
    const user = await userRepository.findOne({ where: { email: ILike(email) } });

    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return null;
    }

    return { id: user.id, email: user.email };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
};
