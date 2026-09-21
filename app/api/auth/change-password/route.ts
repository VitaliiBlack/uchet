import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDataSource } from '@/lib/typeorm';
import { badRequest, getSessionUserId, jsonError, unauthorized } from '@/lib/api';
import { isValidPassword } from '@/lib/validation';
import { logSecurityEvent } from '@/lib/securityEvents';

export const runtime = 'nodejs';

/** Lets a signed-in user replace their own (possibly temporary) password. */
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return unauthorized();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return badRequest('Укажите текущий и новый пароль');
  }
  if (!isValidPassword(newPassword)) {
    return badRequest('Пароль должен быть от 8 до 200 символов');
  }

  const dataSource = await getDataSource();
  const rows = await dataSource.query(
    'SELECT id, email, password FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );
  const user = rows[0];
  if (!user) {
    return unauthorized();
  }

  const currentOk = await bcrypt.compare(currentPassword, user.password);
  if (!currentOk) {
    return jsonError('Неверный текущий пароль', 400);
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    return jsonError('Новый пароль должен отличаться от текущего', 400);
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await dataSource.query(
    `UPDATE users
        SET password = $1,
            must_change_password = false,
            temp_password_set_at = NULL
      WHERE id = $2`,
    [hash, userId]
  );

  await logSecurityEvent({
    type: 'password_reset',
    userId,
    email: String(user.email),
    detail: { self: true },
  });

  return NextResponse.json({ ok: true });
}
