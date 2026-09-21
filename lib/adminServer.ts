import { cookies, headers } from 'next/headers';
import {
  ADMIN_COOKIE,
  isActiveAdmin,
  isAdminIpAllowed,
  verifyAdminToken,
} from '@/lib/adminAuth';

export interface AdminPageSession {
  adminId: number;
  ip: string;
}

/**
 * Server-side admin session for pages (server components): signed cookie +
 * expiry + IP allowlist + active admin. Mirrors the API guard so protected
 * markup is never streamed before authentication.
 */
export const getAdminPageSession = async (): Promise<AdminPageSession | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const verified = verifyAdminToken(token);
  if (!verified) {
    return null;
  }

  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0]!.trim()
    : headerList.get('x-real-ip') ?? 'unknown';

  if (!isAdminIpAllowed(ip)) {
    return null;
  }
  if (!(await isActiveAdmin(verified.adminId))) {
    return null;
  }
  return { adminId: verified.adminId, ip };
};

export const isAdminRequestAuthorized = async (): Promise<boolean> =>
  (await getAdminPageSession()) !== null;
