import { NextResponse } from 'next/server';
import { buildClearAdminCookie, getAdminSession, getAdminSlug } from '@/lib/adminAuth';
import { logSecurityEvent } from '@/lib/securityEvents';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ adminSlug: string }> }
) {
  const { adminSlug } = await context.params;
  if (!getAdminSlug() || adminSlug !== getAdminSlug()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = getAdminSession(request);
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', buildClearAdminCookie());

  if (session) {
    await logSecurityEvent({ type: 'admin_logout', ip: session.ip });
  }
  return response;
}
