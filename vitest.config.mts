import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://uchet:uchet_local_dev@127.0.0.1:55432/uchet_test';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': rootDir },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Shared test database: run test files sequentially to avoid truncate races.
    fileParallelism: false,
    globalSetup: ['./tests/setup/globalSetup.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: 'http://localhost:3001',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**', 'app/api/**', 'components/**'],
    },
  },
});
