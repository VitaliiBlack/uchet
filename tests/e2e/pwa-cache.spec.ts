import { expect, test } from '@playwright/test';

const unique = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

test('service worker cache does not leak another account data', async ({ page, context }) => {
  const aEmail = unique('cache-a');
  const bEmail = unique('cache-b');
  const password = 'E2ePassw0rd!';
  const secretShop = `SECRET-SHOP-${Date.now()}`;

  // --- user A: register, create a secret shop with an operation
  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(aEmail);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  page.on('dialog', (d) => d.accept(secretShop));
  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible({ timeout: 20000 });

  // cache the shell while logged in as A
  await expect
    .poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 20000 })
    .toBe(true);
  await page.reload();
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const c = await caches.open('uchet-shell-v1');
          return (await c.keys()).some((r) => r.url.endsWith('/'));
        }),
      { timeout: 20000 }
    )
    .toBe(true);

  // --- log out A, log in B on the SAME device/context
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: /Выйти/ }).click();
  await expect(page).toHaveURL(/\/login/);

  // B must not exist yet
  const regB = await page.request.post('/api/auth/register', { data: { email: bEmail, password } });
  expect(regB.status()).toBe(201);

  await page.getByPlaceholder('Введите email').fill(bEmail);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  // B sees no shop and no trace of A
  const bWorkspaces = await (await page.request.get('/api/workspaces')).json();
  expect(bWorkspaces).toEqual([]);

  // the SW cache must not contain API responses nor A's secret data
  const cacheAudit = await page.evaluate(async () => {
    const c = await caches.open('uchet-shell-v1');
    const reqs = await c.keys();
    const apiUrls = reqs.map((r) => r.url).filter((u) => u.includes('/api/'));
    let leaked = false;
    for (const r of reqs) {
      const body = await (await c.match(r))?.text().catch(() => '') ?? '';
      if (body.includes('SECRET-SHOP-')) leaked = true;
    }
    return { apiUrls, leaked };
  });
  expect(cacheAudit.apiUrls).toEqual([]);
  expect(cacheAudit.leaked).toBe(false);
});
