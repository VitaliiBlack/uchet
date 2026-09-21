const API_BASE = 'https://api.telegram.org';

export interface InlineButton {
  text: string;
  url: string;
}

export const isTelegramConfigured = (): boolean =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID);

const methodUrl = (method: string): string =>
  API_BASE + '/bot' + process.env.TELEGRAM_BOT_TOKEN + '/' + method;

const chatId = (): string | null => process.env.TELEGRAM_ADMIN_CHAT_ID ?? null;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Telegram rejects inline-button URLs that point at localhost or a bare IP
 * ("Wrong HTTP URL"), which would fail the whole message. Only public hosts
 * get a button; local/dev runs fall back to plain text.
 */
export const isLinkButtonFriendlyUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    // Telegram rejects "localhost"; bare IPs (127.0.0.1, LAN) are accepted.
    if (host === 'localhost' || host === '::1' || host.endsWith('.local')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const postMessage = async (payload: Record<string, unknown>): Promise<Response> =>
  fetch(methodUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

/**
 * Send-only admin notification. Never throws and never logs the token.
 */
export const sendAdminMessage = async (
  text: string,
  buttons?: InlineButton[][]
): Promise<boolean> => {
  const target = chatId();
  if (!process.env.TELEGRAM_BOT_TOKEN || !target) {
    return false;
  }

  const base: Record<string, unknown> = {
    chat_id: target,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  try {
    if (buttons && buttons.length > 0) {
      const withButtons = { ...base, reply_markup: { inline_keyboard: buttons } };
      let response = await postMessage(withButtons);
      if (!response.ok) {
        // A rejected button must never swallow the notification itself.
        const detail = await response.text().catch(() => '');
        console.error('Telegram buttons rejected (' + response.status + '): ' + detail.slice(0, 200));
        response = await postMessage(base);
      }
      if (response.ok) {
        return true;
      }
      const detail = await response.text().catch(() => '');
      console.error('Telegram sendMessage failed with status ' + response.status + ': ' + detail.slice(0, 200));
      return false;
    }

    const response = await postMessage(base);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Telegram sendMessage failed with status ' + response.status + ': ' + detail.slice(0, 200));
      return false;
    }
    return true;
  } catch {
    console.error('Telegram sendMessage error');
    return false;
  }
};

/** Sends a document (e.g. a DB snapshot) to the admin chat. */
export const sendAdminDocument = async (
  filename: string,
  content: Buffer,
  caption?: string
): Promise<boolean> => {
  const target = chatId();
  if (!process.env.TELEGRAM_BOT_TOKEN || !target) {
    return false;
  }
  try {
    const form = new FormData();
    form.append('chat_id', target);
    if (caption) {
      form.append('caption', caption);
    }
    form.append('document', new Blob([new Uint8Array(content)]), filename);
    const response = await fetch(methodUrl('sendDocument'), { method: 'POST', body: form });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Telegram sendDocument failed with status ' + response.status + ': ' + detail.slice(0, 200));
      return false;
    }
    return true;
  } catch {
    console.error('Telegram sendDocument error');
    return false;
  }
};

export const telegramEscape = escapeHtml;
