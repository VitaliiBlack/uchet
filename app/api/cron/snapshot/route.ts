import { NextResponse } from 'next/server';
import { createSnapshot } from '@/lib/dbDump';
import { sendAdminDocument } from '@/lib/telegram';
import { logSecurityEvent } from '@/lib/securityEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Scheduled database snapshot, triggered by Vercel Cron (see vercel.json).
 * Protected by CRON_SECRET; the app builds the dump in-process (no pg_dump) and
 * ships it to Telegram, which is the durable copy on serverless.
 */
const isAuthorized = (request: Request): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const header = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  return header === 'Bearer ' + secret || cronHeader === secret;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshot = await createSnapshot();
    const sentToTelegram = await sendAdminDocument(
      snapshot.filename,
      snapshot.content,
      '💾 Автоснапшот БД uchet · ' + new Date().toLocaleString('ru-RU')
    );

    await logSecurityEvent({
      type: 'admin_snapshot',
      ip: 'cron',
      detail: {
        filename: snapshot.filename,
        bytes: snapshot.bytes,
        sentToTelegram,
        source: 'cron',
      },
    });

    return NextResponse.json({
      ok: true,
      filename: snapshot.filename,
      bytes: snapshot.bytes,
      sentToTelegram,
    });
  } catch (error) {
    console.error('cron snapshot failed:', error);
    return NextResponse.json({ error: 'Snapshot failed' }, { status: 500 });
  }
}
