import { expect, test } from '@playwright/test';

const unique = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

test('KNOWN LIMITATION: session token still works after logout (stateless JWT)', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const email = unique('logout');
  const password = 'E2ePassw0rd!';

  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  // capture the session cookie before logout
  const cookie = (await context.cookies()).find((c) => c.name.includes('session-token'));
  expect(cookie).toBeTruthy();

  // confirm the token works while logged in
  const before = await request.get(`${baseURL}/api/workspaces`, {
    headers: { Cookie: `${cookie!.name}=${cookie!.value}` },
  });
  expect(before.status()).toBe(200);

  // logout via the menu
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: /Выйти/ }).click();
  await expect(page).toHaveURL(/\/login/);

  // reuse the captured token AFTER logout
  const after = await request.get(`${baseURL}/api/workspaces`, {
    headers: { Cookie: `${cookie!.name}=${cookie!.value}` },
  });

  // Current behaviour: a stateless JWT is not revoked server-side on logout.
  // This test CHARACTERIZES (documents) that limitation.
  expect(after.status()).toBe(200);
});

test.fixme('target: after logout the captured token must be rejected (401)', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const email = unique('logout2');
  const password = 'E2ePassw0rd!';

  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  const cookie = (await context.cookies()).find((c) => c.name.includes('session-token'));
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: /Выйти/ }).click();

  const after = await request.get(`${baseURL}/api/workspaces`, {
    headers: { Cookie: `${cookie!.name}=${cookie!.value}` },
  });
  expect(after.status()).toBe(401);
});
