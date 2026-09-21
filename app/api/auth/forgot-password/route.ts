import { after, NextResponse } from 'next/server';
import { getDataSource } from '@/lib/typeorm';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { normalizeEmail } from '@/lib/validation';
import { logSecurityEvent } from '@/lib/securityEvents';
import { isLinkButtonFriendlyUrl, sendAdminMessage, telegramEscape } from '@/lib/telegram';
import { getAdminSlug } from '@/lib/adminAuth';

export const runtime = 'nodejs';

const IP_LIMIT = 5;
const IP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_COOLDOWN_MS = 30 * 60 * 1000;
const GLOBAL_CAP = 25;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;

// In-memory budget so a flood of requests cannot spam the admin chat one-by-one.
let windowStart = Date.now();
let sentCount = 0;
let capAlerted = false;

const takeBudget = (): { allow: boolean; justHitCap: boolean } => {
  const now = Date.now();
  if (now - windowStart > GLOBAL_WINDOW_MS) {
    windowStart = now;
    sentCount = 0;
    capAlerted = false;
  }
  if (sentCount >= GLOBAL_CAP) {
    if (!capAlerted) {
      capAlerted = true;
      return { allow: false, justHitCap: true };
    }
    return { allow: false, justHitCap: false };
  }
  sentCount += 1;
  return { allow: true, justHitCap: false };
};

// Runs the notification after the HTTP response is sent: no timing leak for the
// caller, and Next keeps the work alive (important on serverless). Falls back to
// fire-and-forget when called outside a request scope (e.g. unit tests).
const scheduleAfterResponse = (task: () => Promise<unknown>): void => {
  try {
    after(() => {
      void task();
    });
  } catch {
    void task();
  }
};

// The response is always identical: it must not reveal whether the email exists.
export async function POST(request: Request) {
  const generic = NextResponse.json({ ok: true });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return generic;
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return generic;
  }

  const ip = clientIp(request);
  const ipLimit = rateLimit('forgot-ip:' + ip, IP_LIMIT, IP_WINDOW_MS);
  const emailLimit = rateLimit('forgot-email:' + email, 1, EMAIL_COOLDOWN_MS);

  try {
    const dataSource = await getDataSource();
    const rows = await dataSource.query(
      'SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1',
      [email]
    );
    const user = rows[0];

    await logSecurityEvent({
      type: 'password_reset_request',
      userId: user ? Number(user.id) : null,
      email,
      ip,
      detail: {
        exists: Boolean(user),
        ipThrottled: !ipLimit.ok,
        emailThrottled: !emailLimit.ok,
      },
    });

    if (user && ipLimit.ok && emailLimit.ok) {
      const budget = takeBudget();
      const rawOrigin = (process.env.NEXTAUTH_URL ?? new URL(request.url).origin).replace(/\/$/, '');
      // Telegram rejects "localhost" in button URLs; 127.0.0.1 is accepted and
      // opens the admin on desktop Telegram running on the same machine.
      const origin = rawOrigin.replace('://localhost', '://127.0.0.1');
      const slug = getAdminSlug();
      const link =
        slug && isLinkButtonFriendlyUrl(origin) ? origin + '/' + slug + '/requests' : undefined;

      if (budget.allow) {
        scheduleAfterResponse(() =>
          sendAdminMessage(
            '🔐 <b>Запрос на сброс пароля</b>\n' +
              'Email: <code>' + telegramEscape(email) + '</code>\n' +
              'Время: ' + new Date().toLocaleString('ru-RU') + '\n' +
              'IP: <code>' + telegramEscape(ip) + '</code>',
            link ? [[{ text: 'Открыть в админке', url: link }]] : undefined
          )
        );
      } else if (budget.justHitCap) {
        scheduleAfterResponse(() =>
          sendAdminMessage(
            '⚠️ <b>Всплеск запросов сброса пароля</b>\n' +
              'Достигнут лимит ' + GLOBAL_CAP + ' уведомлений в час. ' +
              'Дальше уведомления временно не отправляются.'
          )
        );
      }
    }
  } catch (error) {
    console.error('forgot-password error:', error);
  }

  return generic;
}
