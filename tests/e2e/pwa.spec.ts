import { expect, test } from '@playwright/test';

test('serves a valid PWA manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.name).toBe('Uchet');
  expect(manifest.display).toBe('standalone');
  expect(Array.isArray(manifest.icons)).toBe(true);
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test('registers a service worker', async ({ page }) => {
  await page.goto('/login');
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return false;
          const reg = await navigator.serviceWorker.getRegistration();
          return Boolean(reg);
        }),
      { timeout: 15000 }
    )
    .toBe(true);
});
