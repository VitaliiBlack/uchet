import { expect, test } from '@playwright/test';

const unique = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

test('service worker caches the app shell for offline and never caches API', async ({ page, context }) => {
  const email = unique('offline');
  const password = 'E2ePassw0rd!';

  // register + login -> lands on the app shell "/"
  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  // service worker active
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          return Boolean(reg?.active);
        }),
      { timeout: 20000 }
    )
    .toBe(true);

  // a SW-controlled full navigation to "/" gets cached
  await page.reload();
  await expect
    .poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 20000,
    })
    .toBe(true);

  const rootUrl = new URL(page.url()).origin + '/';
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const cache = await caches.open('uchet-shell-v1');
          return (await cache.keys()).map((r) => r.url);
        }),
      { timeout: 20000 }
    )
    .toContain(rootUrl);

  // static assets cached for offline rendering
  const staticCached = await page.evaluate(async () => {
    const cache = await caches.open('uchet-shell-v1');
    return (await cache.keys()).some((r) => r.url.includes('/_next/static/'));
  });
  expect(staticCached).toBe(true);

  // API responses must NEVER be cached
  const apiCached = await page.evaluate(async () => {
    await fetch('/api/auth/session', { cache: 'no-store' }).catch(() => undefined);
    const cache = await caches.open('uchet-shell-v1');
    return (await cache.keys()).some((r) => r.url.includes('/api/'));
  });
  expect(apiCached).toBe(false);

  // truly offline: the shell is served from the SW cache
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  await context.setOffline(false);
});
