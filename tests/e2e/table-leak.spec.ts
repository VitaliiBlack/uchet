import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const unique = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

const isOpSave = (r: import('@playwright/test').Response) =>
  r.url().includes('/api/financial-data') &&
  ['POST', 'PUT'].includes(r.request().method());

// Register via API with a unique source IP so the in-memory registration
// rate-limit (10/hour per IP) never collides across tests sharing localhost.
const apiRegister = async (request: APIRequestContext, email: string, password: string) => {
  const ip = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  return request.post('/api/auth/register', {
    data: { email, password },
    headers: { 'X-Forwarded-For': ip },
  });
};

const login = async (page: import('@playwright/test').Page, email: string, password: string) => {
  await page.goto('/login');
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);
};

// A seeds a secret row into the calendar table; a different account (B) must
// never see that row in its own calendar table, neither in the DOM nor in any
// /api/financial-data response it receives.
test('cross-account: B calendar table never shows A rows', async ({ page, request }) => {
  const aEmail = unique('leak-a');
  const bEmail = unique('leak-b');
  const password = 'E2ePassw0rd!';
  const LEAK = `LEAKMARK-${Date.now()}`;

  let nextName = 'A Shop';
  page.on('dialog', (d) => d.accept(nextName));

  expect((await apiRegister(request, aEmail, password)).status()).toBe(201);
  await login(page, aEmail, password);

  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /Открыть день/ }).first().click();
  await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);

  await page.getByPlaceholder('Описание').nth(0).fill(LEAK);
  await page.locator('input[type="number"]').nth(0).fill('1111');
  const saved = page.waitForResponse(isOpSave);
  await page.locator('input[type="number"]').nth(2).click();
  await saved;

  // --- log out A
  await page.getByRole('button', { name: /К календарю/ }).click();
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: /Выйти/ }).click();
  await expect(page).toHaveURL(/\/login/);

  // --- B: register via API, login, create own shop, open the SAME calendar table
  expect((await apiRegister(request, bEmail, password)).status()).toBe(201);
  await login(page, bEmail, password);

  // capture every financial-data response B receives from here on
  const bodies: string[] = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/financial-data')) {
      try { bodies.push(await res.text()); } catch { /* ignore */ }
    }
  });

  nextName = 'B Shop';
  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /Открыть день/ }).first().click();
  await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);

  // B's table is empty and must not contain A's secret row
  await expect(page.getByPlaceholder('Описание').nth(0)).toHaveValue('');
  await expect(page.locator('body')).not.toContainText(LEAK);

  // and no financial-data response B received ever carried A's secret
  for (const b of bodies) {
    expect(b.includes(LEAK)).toBe(false);
  }
});

// The sharing feature must surface EXACTLY the shared shop's table rows and
// never another shop of the owner.
test('shared shop: collaborator table shows only the shared shop rows', async ({ page, browser, request }) => {
  const aEmail = unique('share-a');
  const bEmail = unique('share-b');
  const password = 'E2ePassw0rd!';
  const SHARED = `SHARED-${Date.now()}`;
  const PRIVATE = `PRIVATE-${Date.now()}`;

  let nextName = 'Shared Shop';
  page.on('dialog', (d) => d.accept(nextName));

  // B must exist before the owner adds them by email
  expect((await apiRegister(request, bEmail, password)).status()).toBe(201);
  expect((await apiRegister(request, aEmail, password)).status()).toBe(201);
  await login(page, aEmail, password);

  // shop 1 -> shared, with a visible row
  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /Открыть день/ }).first().click();
  await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);
  await page.getByPlaceholder('Описание').nth(0).fill(SHARED);
  await page.locator('input[type="number"]').nth(0).fill('2222');
  const s1 = page.waitForResponse(isOpSave);
  await page.locator('input[type="number"]').nth(2).click();
  await s1;
  await page.getByRole('button', { name: /К календарю/ }).click();

  // shop 2 -> private, with a hidden row
  nextName = 'Private Shop';
  await page.getByRole('button', { name: 'Добавить магазин' }).click();
  await expect(page.locator('select option')).toHaveCount(2);
  await page.locator('select').selectOption({ label: 'Private Shop' });
  await page.getByRole('button', { name: /Открыть день/ }).first().click();
  await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);
  await page.getByPlaceholder('Описание').nth(0).fill(PRIVATE);
  await page.locator('input[type="number"]').nth(0).fill('3333');
  const s2 = page.waitForResponse(isOpSave);
  await page.locator('input[type="number"]').nth(2).click();
  await s2;
  await page.getByRole('button', { name: /К календарю/ }).click();

  // share only "Shared Shop" with B
  await page.locator('select').selectOption({ label: 'Shared Shop' });
  await page.getByRole('button', { name: 'Поделиться магазином' }).click();
  await expect(page.getByRole('heading', { name: 'Доступ к магазину' })).toBeVisible();
  await page.getByLabel('Email пользователя').fill(bEmail);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByText(bEmail)).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();

  // collaborator logs in via a fresh browser context
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await login(page2, bEmail, password);

  await expect(page2.getByRole('button', { name: 'Приглашения' })).toBeVisible({ timeout: 20000 });
  await page2.getByRole('button', { name: 'Приглашения' }).click();
  await page2.getByRole('button', { name: 'Принять' }).click();
  await page2.getByRole('button', { name: 'Закрыть', exact: true }).click();

  await expect(page2.locator('select option')).toHaveCount(1);
  await page2.getByRole('button', { name: /Открыть день/ }).first().click();
  await expect(page2).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);

  // sees the shared row, never the private one
  await expect(page2.getByPlaceholder('Описание').nth(0)).toHaveValue(SHARED);
  await expect(page2.locator('body')).not.toContainText(PRIVATE);
  const values = await page2.locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(values.join('|')).toContain(SHARED);
  expect(values.join('|')).not.toContain(PRIVATE);

  await context2.close();
});
