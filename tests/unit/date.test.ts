import { describe, expect, it } from 'vitest';
import { formatDateKey, normalizeDateKey, parseDateKey } from '@/lib/date';

describe('date utils', () => {
  it('formats a Date to YYYY-MM-DD in local time', () => {
    expect(formatDateKey(new Date(2026, 8, 5))).toBe('2026-09-05');
  });

  it('normalizes date keys and ISO strings without TZ drift', () => {
    expect(normalizeDateKey('2026-09-05T00:00:00.000Z')).toBe('2026-09-05');
    expect(normalizeDateKey('2026-09-05')).toBe('2026-09-05');
  });

  it('parses a date key to a local Date', () => {
    const d = parseDateKey('2026-09-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(5);
  });
});
