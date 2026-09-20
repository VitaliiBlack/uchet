import { expect, test } from '@playwright/test';

const unique = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

test('autosave creates exactly one operation (no duplicates)', async ({ page }) => {
  const email = unique('autosave-a');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill('E2ePassw0rd!');
  await page.getByPlaceholder('Повторите пароль').fill('E2ePassw0rd!');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  page.on('dialog', (d) => d.accept('Shop'));
  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /Открыть день/ }).first().click();

  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/financial-data') && r.method() === 'POST') posts.push(r.postData() || '');
  });

  const numbers = page.locator('input[type="number"]');
  const desc = page.getByPlaceholder('Описание');
  await desc.nth(0).fill('X');
  await numbers.nth(0).fill('1000');
  await numbers.nth(1).fill('200');
  await numbers.nth(2).click();
  await page.waitForTimeout(2000);

  const ops = await (await page.request.get('/api/financial-data')).json();
  expect(posts).toHaveLength(1);
  expect(ops).toHaveLength(1);
});
