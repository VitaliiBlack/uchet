import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDataSource } from '@/lib/typeorm';
import { requireAdmin } from '@/lib/adminGuard';
import { logSecurityEvent } from '@/lib/securityEvents';
import {
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  parsePositiveInt,
} from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ adminSlug: string; id: string }> }
) {
  const { adminSlug, id } = await context.params;
  const guard = await requireAdmin(request, adminSlug);
  if ('response' in guard) {
    return guard.response;
  }

  const userId = parsePositiveInt(id);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const dataSource = await getDataSource();
  const target = await dataSource.query('SELECT id, email FROM users WHERE id = $1 LIMIT 1', [userId]);
  if (!target[0]) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const email = String(target[0].email);
  const action = body.action;

  if (action === 'reset-password') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Password must be 8-200 characters' },
        { status: 400 }
      );
    }
    const hash = await bcrypt.hash(password, 10);
    // Bump session_version so every existing session of this user is revoked.
    await dataSource.query(
      'UPDATE users SET password = $1, session_version = session_version + 1 WHERE id = $2',
      [hash, userId]
    );
    await logSecurityEvent({
      type: 'password_reset',
      userId,
      email,
      ip: guard.session.ip,
      detail: { byAdmin: guard.session.adminId },
    });
    return NextResponse.json({ ok: true, revokedSessions: true });
  }

  if (action === 'change-email') {
    const nextEmail = normalizeEmail(body.email);
    if (!isValidEmail(nextEmail)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    const duplicate = await dataSource.query(
      'SELECT id FROM users WHERE lower(email) = $1 AND id <> $2 LIMIT 1',
      [nextEmail, userId]
    );
    if (duplicate[0]) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    await dataSource.query('UPDATE users SET email = $1 WHERE id = $2', [nextEmail, userId]);
    await logSecurityEvent({
      type: 'email_change',
      userId,
      email: nextEmail,
      ip: guard.session.ip,
      detail: { byAdmin: guard.session.adminId, previousEmail: email },
    });
    return NextResponse.json({ ok: true, email: nextEmail });
  }

  if (action === 'revoke-sessions') {
    await dataSource.query(
      'UPDATE users SET session_version = session_version + 1 WHERE id = $1',
      [userId]
    );
    await logSecurityEvent({
      type: 'session_revoked',
      userId,
      email,
      ip: guard.session.ip,
      detail: { byAdmin: guard.session.adminId },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
