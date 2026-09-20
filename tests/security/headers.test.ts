import { afterEach, describe, expect, it, vi } from 'vitest';

const headerKeys = async () => {
  vi.resetModules();
  const cfg = (await import('@/next.config')).default;
  const entries = await cfg.headers!();
  return entries.flatMap((entry) => entry.headers.map((h) => h.key));
};

describe('security headers config', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('disables the powered-by header', async () => {
    vi.resetModules();
    const cfg = (await import('@/next.config')).default;
    expect(cfg.poweredByHeader).toBe(false);
  });

  it('sets base hardening headers', async () => {
    const keys = await headerKeys();
    for (const key of [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]) {
      expect(keys).toContain(key);
    }
  });

  it('adds CSP + HSTS in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const keys = await headerKeys();
    expect(keys).toContain('Content-Security-Policy');
    expect(keys).toContain('Strict-Transport-Security');
  });
});
