import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://uchet:uchet_local_dev@127.0.0.1:55432/uchet_test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `./node_modules/.bin/next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: `http://localhost:${PORT}`,
    },
  },
});
