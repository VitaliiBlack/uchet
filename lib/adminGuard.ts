import type { NextResponse } from 'next/server';
import {
  adminNotFound,
  adminUnauthorized,
  getAdminSession,
  getAdminSlug,
  isActiveAdmin,
  type AdminSession,
} from '@/lib/adminAuth';

export type AdminGuard = { session: AdminSession } | { response: NextResponse };

/**
 * Single entry point for every admin API route: verifies the URL slug matches
 * the configured secret, the signed admin cookie, and that the admin is active.
 */
export const requireAdmin = async (request: Request, slug: string): Promise<AdminGuard> => {
  if (!getAdminSlug() || slug !== getAdminSlug()) {
    return { response: adminNotFound() };
  }
  const session = getAdminSession(request);
  if (!session) {
    return { response: adminUnauthorized() };
  }
  if (!(await isActiveAdmin(session.adminId))) {
    return { response: adminUnauthorized() };
  }
  return { session };
};
