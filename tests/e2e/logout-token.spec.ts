import { expect, test } from '@playwright/test';

const unique = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;

test('logout revokes the captured token (401)', async ({ page, context, request, baseURL }) => {
  const email = unique('logout');
  const password = 'E2ePassw0rd!';

  await page.goto('/login');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.getByPlaceholder('Введите email').fill(email);
  await page.getByPlaceholder('Введите пароль').fill(password);
  await page.getByPlaceholder('Повторите пароль').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/localhost:3100\/$/);

  const cookie = (await context.cookies()).find((c) => c.name.includes('session-token'));
  expect(cookie).toBeTruthy();

  // token works while logged in
  const before = await request.get(`${baseURL}/api/workspaces`, {
    headers: { Cookie: `${cookie!.name}=${cookie!.value}` },
  });
  expect(before.status()).toBe(200);

  // logout
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.getByRole('button', { name: /Выйти/ }).click();
  await expect(page).toHaveURL(/\/login/);

  // the captured token must now be rejected
  const after = await request.get(`${baseURL}/api/workspaces`, {
    headers: { Cookie: `${cookie!.name}=${cookie!.value}` },
  });
  expect(after.status()).toBe(401);

  // and the session endpoint no longer exposes a user
  const session = await request.get(`${baseURL}/api/auth/session`, {
    headers: { Cookie: `${cookie!.name}=${cookie!.value}` },
  });
  const sessionBody = (await session.json()) as { user?: unknown } | null;
  expect(sessionBody?.user ?? null).toBeNull();
});
