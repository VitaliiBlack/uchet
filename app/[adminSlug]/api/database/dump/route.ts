import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminGuard';
import { createSnapshot } from '@/lib/dbDump';
import { logSecurityEvent } from '@/lib/securityEvents';
import { sendAdminDocument } from '@/lib/telegram';

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

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const snapshot = await createSnapshot();
    await logSecurityEvent({
      type: 'admin_dump',
      ip: guard.session.ip,
      detail: { filename: snapshot.filename, bytes: snapshot.bytes },
    });

    let sentToTelegram = false;
    if (body.sendToTelegram === true) {
      sentToTelegram = await sendAdminDocument(
        snapshot.filename,
        snapshot.content,
        '💾 Дамп БД uchet · ' + new Date().toLocaleString('ru-RU')
      );
      await logSecurityEvent({
        type: 'admin_snapshot',
        ip: guard.session.ip,
        detail: { filename: snapshot.filename, sentToTelegram },
      });
    }

    return NextResponse.json({
      filename: snapshot.filename,
      bytes: snapshot.bytes,
      createdAt: snapshot.createdAt,
      sentToTelegram,
    });
  } catch (error) {
    console.error('dump failed:', error);
    return NextResponse.json({ error: 'Не удалось создать дамп' }, { status: 500 });
  }
}
