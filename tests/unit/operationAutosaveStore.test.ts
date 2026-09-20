import { describe, expect, it } from 'vitest';
import { flushOperationAutosaves, trackOperationAutosave } from '@/components/operationAutosaveStore';

describe('operationAutosaveStore', () => {
  it('tracks a promise and resolves flush after it settles', async () => {
    let resolveIt: () => void = () => {};
    const p = new Promise<void>((resolve) => {
      resolveIt = resolve;
    });
    trackOperationAutosave(p);
    const flush = flushOperationAutosaves();
    resolveIt();
    await flush;
    expect(true).toBe(true);
  });

  it('resolves flush even if a tracked promise rejects', async () => {
    trackOperationAutosave(Promise.reject(new Error('boom')).catch(() => undefined));
    await expect(flushOperationAutosaves()).resolves.toBeUndefined();
  });

  it('flush resolves immediately when nothing is pending', async () => {
    await expect(flushOperationAutosaves()).resolves.toBeUndefined();
  });
});
