import { expect, test } from '@playwright/test';

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

test('unauthenticated visitor is redirected to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Добро пожаловать' })).toBeVisible();
});

test('register -> create shop -> calendar -> open today', async ({ page }) => {
  const email = uniqueEmail();
  const password = 'E2ePassw0rd!';

  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/localhost:3100\/$/);

  // A fresh user has no shop yet: create one via the prompt dialog.
  page.on('dialog', (dialog) => dialog.accept('E2E Shop'));
  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();

  const dayButton = page.getByRole('button', { name: /Открыть день/ }).first();
  await expect(dayButton).toBeVisible({ timeout: 20000 });
  await dayButton.click();

  await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole('heading', { name: /Операции за/ })).toBeVisible();
});
