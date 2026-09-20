import { NextResponse } from 'next/server';
import {
  buildAdminCookie,
  getAdminSlug,
  signAdminToken,
  verifyAdminCredentials,
} from '@/lib/adminAuth';
import { clientIp } from '@/lib/rateLimit';
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = await verifyAdminCredentials(request, body.email, body.password);
  const ip = clientIp(request);

  if (!result.ok) {
    await logSecurityEvent({
      type: 'admin_login_fail',
      email: typeof body.email === 'string' ? body.email : null,
      ip,
      detail: { reason: result.reason },
    });
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = signAdminToken(result.admin.id);
  if (!token) {
    return NextResponse.json({ error: 'Admin session is not configured' }, { status: 500 });
  }

  await logSecurityEvent({ type: 'admin_login_ok', email: result.admin.email, ip });

  const response = NextResponse.json({ admin: result.admin });
  response.headers.set('Set-Cookie', buildAdminCookie(token));
  return response;
}
