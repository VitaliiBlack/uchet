import { NextResponse } from 'next/server';
import { changeAdminCredentials } from '@/lib/adminAuth';
import { requireAdmin } from '@/lib/adminGuard';
import { logSecurityEvent } from '@/lib/securityEvents';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ adminSlug: string }> }
) {
  const { adminSlug } = await context.params;
  const guard = await requireAdmin(request, adminSlug);
  if ('response' in guard) {
    return guard.response;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = await changeAdminCredentials(
    guard.session.adminId,
    typeof body.currentPassword === 'string' ? body.currentPassword : '',
    body.newEmail,
    body.newPassword
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await logSecurityEvent({
    type: 'admin_action',
    ip: guard.session.ip,
    detail: { action: 'change-credentials' },
  });

  return NextResponse.json({ ok: true });
}
