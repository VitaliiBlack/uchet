import { expect, test } from '@playwright/test';

const unique = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

const isOpSave = (r: import('@playwright/test').Response) =>
  r.url().includes('/api/financial-data') &&
  ['POST', 'PUT'].includes(r.request().method());

type ApiOp = { id: number; description: string; income: string; expense: string; profit: string };

test('full working cycle: register -> shops -> fill day -> edit -> delete -> isolate -> relogin', async ({ page }) => {
  const email = unique('cycle');
  const password = 'E2ePassw0rd!';

  const ops = async (): Promise<ApiOp[]> =>
    (await (await page.request.get('/api/financial-data')).json()) as ApiOp[];
  const findOp = async (description: string) =>
    (await ops()).find((o) => o.description === description);

  // 1. register
  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  // 2. create two shops
  let nextName = 'Магазин A';
  page.on('dialog', (d) => d.accept(nextName));
  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible({ timeout: 20000 });
  nextName = 'Магазин B';
  await page.getByRole('button', { name: 'Добавить магазин' }).click();
  await expect(page.locator('select option')).toHaveCount(2);

  // 3. work in shop A, open today
  await page.locator('select').selectOption({ label: 'Магазин A' });
  await page.getByRole('button', { name: /Открыть день/ }).first().click();
  await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);

  const numbers = page.locator('input[type="number"]');
  const desc = page.getByPlaceholder('Описание');
  const descIndex = (label: string) =>
    desc.evaluateAll(
      (els, target) => els.findIndex((e) => (e as HTMLInputElement).value === target),
      label
    );

  // 4. operation #1 (1000 / 200)
  await desc.nth(0).fill('Продажи');
  await numbers.nth(0).fill('1000');
  await numbers.nth(1).fill('200');
  const s1 = page.waitForResponse(isOpSave);
  await numbers.nth(2).click();
  await s1;

  // 5. operation #2 (600 / 100)
  await desc.nth(1).fill('Аренда');
  await numbers.nth(2).fill('600');
  await numbers.nth(3).fill('100');
  const s2 = page.waitForResponse(isOpSave);
  await numbers.nth(4).click();
  await s2;

  // 6. persisted in the DB
  await expect
    .poll(async () => (await ops()).map((o) => o.description).sort())
    .toEqual(['Аренда', 'Продажи']);

  // 7. edit "Продажи" income -> 1500
  const iProd = await descIndex('Продажи');
  await numbers.nth(iProd * 2).fill('1500');
  const s3 = page.waitForResponse(isOpSave);
  await numbers.nth(iProd * 2 + 2).click();
  await s3;
  const prod = await findOp('Продажи');
  expect(prod?.income).toBe('1500');

  // 8. delete "Аренда"
  const iRent = await descIndex('Аренда');
  await page.getByRole('button', { name: 'Удалить операцию' }).nth(iRent).click();
  await expect.poll(async () => (await findOp('Аренда')) ?? null).toBeNull();
  expect((await ops()).length).toBe(1);

  // 9. calendar totals: 1500 - 200 = 1300
  await page.getByRole('button', { name: /К календарю/ }).click();
  await expect(page).toHaveURL(/localhost:3100\/$/);
  await expect(page.getByText('1300').first()).toBeVisible({ timeout: 15000 });

  // 10. isolation: shop B has no data
  await page.locator('select').selectOption({ label: 'Магазин B' });
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /Открыть день/ }).first().click();
  await expect(page.getByPlaceholder('Описание').nth(0)).toHaveValue('');

  // 11. logout + login -> data persists in shop A
  await page.getByRole('button', { name: /К календарю/ }).click();
  await expect(page).toHaveURL(/localhost:3100\/$/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: /Выйти/ }).click();
  await page.waitForURL(/\/login/, { timeout: 20000 });
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);
  await page.locator('select').selectOption({ label: 'Магазин A' });
  await expect(page.getByText('1300').first()).toBeVisible({ timeout: 15000 });
});