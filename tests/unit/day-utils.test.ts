import { describe, expect, it } from 'vitest';
import { calculateProfit, createEmptyOperation, generateLocalId, isEmptyOperation } from '@/app/day/[date]/utils';

describe('day utils', () => {
  it('calculateProfit treats empty as zero', () => {
    expect(calculateProfit('10', '3')).toBe(7);
    expect(calculateProfit('', '')).toBe(0);
    expect(calculateProfit('0', '5')).toBe(-5);
    expect(calculateProfit(10, 3)).toBe(7);
  });

  it('isEmptyOperation detects blank rows', () => {
    expect(isEmptyOperation({ id: -1, date: '2026-09-01', income: '', expense: '', description: '', profit: 0 })).toBe(true);
    expect(isEmptyOperation({ id: -1, date: '2026-09-01', income: '1', expense: '', description: '', profit: 0 })).toBe(false);
    expect(isEmptyOperation({ id: -1, date: '2026-09-01', income: '', expense: '', description: 'x', profit: 0 })).toBe(false);
  });

  it('createEmptyOperation is blank and has a unique localId', () => {
    const a = createEmptyOperation('2026-09-01');
    const b = createEmptyOperation('2026-09-01');
    expect(a.id).toBe(-1);
    expect(a.date).toBe('2026-09-01');
    expect(isEmptyOperation(a)).toBe(true);
    expect(a.localId).not.toBe(b.localId);
    expect(generateLocalId()).toMatch(/^local-/);
  });
});
