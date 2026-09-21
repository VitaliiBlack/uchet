/**
 * Small fetch helper for admin client components. On 401 it bounces to the
 * admin login page; other errors surface to React Query.
 */
export const fetchAdminJson = async <T>(
  url: string,
  loginRedirect: string
): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (response.status === 401) {
    window.location.href = loginRedirect;
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    throw new Error('request failed with status ' + response.status);
  }
  return (await response.json()) as T;
};

export const postAdminJson = async <T>(
  url: string,
  body: unknown,
  loginRedirect: string
): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status === 401) {
    window.location.href = loginRedirect;
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'request failed');
  }
  return (await response.json()) as T;
};

export const fmtBytes = (value: string | number): string => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let size = bytes;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return size.toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
};

export const fmtDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleString('ru-RU') : '—';
