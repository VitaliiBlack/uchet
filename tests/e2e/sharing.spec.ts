import { expect, test } from '@playwright/test';

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

test('owner shares ONE shop; collaborator sees only that shop', async ({ page, browser, request }) => {
  const ownerEmail = unique('owner');
  const memberEmail = unique('member');
  const password = 'E2ePassw0rd!';

  // member account must exist to be added by email (registered via API, no session needed)
  const reg = await request.post('/api/auth/register', { data: { email: memberEmail, password } });
  expect(reg.status()).toBe(201);

  // register owner via UI
  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(ownerEmail);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  // create two shops
  let nextName = 'Owned A';
  page.on('dialog', (dialog) => dialog.accept(nextName));

  await page.getByRole('button', { name: 'Добавить магазин' }).last().click();
  await expect(page.getByRole('button', { name: /Открыть день/ }).first()).toBeVisible({ timeout: 20000 });

  nextName = 'Owned B';
  await page.getByRole('button', { name: 'Добавить магазин' }).click();
  await expect(page.locator('select option')).toHaveCount(2);

  // share only "Owned A"
  await page.locator('select').selectOption({ label: 'Owned A' });
  await page.getByRole('button', { name: 'Поделиться магазином' }).click();
  await expect(page.getByRole('heading', { name: 'Доступ к магазину' })).toBeVisible();
  await page.getByLabel('Email пользователя').fill(memberEmail);
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByText(memberEmail)).toBeVisible();
  await page.keyboard.press('Escape');

  // collaborator logs in via a fresh browser context
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto('/login');
  await page2.getByPlaceholder('Введите email').fill(memberEmail);
  await page2.getByPlaceholder('Введите пароль').fill(password);
  await page2.locator('button[type="submit"]').click();
  await expect(page2).toHaveURL(/localhost:3100\/$/);

  // invitation is pending: no shared shop until the member accepts
  await expect(page2.getByRole('button', { name: 'Приглашения' })).toBeVisible({ timeout: 20000 });
  await expect(page2.locator('select option')).toHaveCount(0);

  await page2.getByRole('button', { name: 'Приглашения' }).click();
  await page2.getByRole('button', { name: 'Принять' }).click();

  // after consent: sees EXACTLY one shared shop, not the other
  await expect(page2.locator('select option')).toHaveCount(1);
  await expect(page2.getByRole('option', { name: 'Owned A (совм.)' })).toBeAttached();
  await expect(page2.getByRole('option', { name: 'Owned B' })).toHaveCount(0);

  // collaborator is not an owner -> no sharing control
  await expect(page2.getByRole('button', { name: 'Поделиться магазином' })).toHaveCount(0);

  await context2.close();
});
