import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientIp, rateLimit, resetRateLimits } from '@/lib/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useRealTimers();
  });

  it('allows requests up to the limit, then blocks', () => {
    const key = 'k1';
    expect(rateLimit(key, 3, 1000).ok).toBe(true);
    expect(rateLimit(key, 3, 1000).ok).toBe(true);
    expect(rateLimit(key, 3, 1000).ok).toBe(true);

    const blocked = rateLimit(key, 3, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    vi.useFakeTimers();
    const key = 'k2';
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
    expect(rateLimit(key, 1, 1000).ok).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
  });

  it('separates buckets by key', () => {
    expect(rateLimit('a', 1, 1000).ok).toBe(true);
    expect(rateLimit('a', 1, 1000).ok).toBe(false);
    expect(rateLimit('b', 1, 1000).ok).toBe(true);
  });

  it('extracts the client ip', () => {
    const withForwarded = new Request('http://x/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(clientIp(withForwarded)).toBe('1.2.3.4');
    expect(clientIp(new Request('http://x/'))).toBe('unknown');
  });
});
