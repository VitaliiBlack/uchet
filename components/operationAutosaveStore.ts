"use client";

const pendingAutosaves = new Set<Promise<unknown>>();

export const trackOperationAutosave = <T>(promise: Promise<T>) => {
  pendingAutosaves.add(promise);
  promise.then(
    () => pendingAutosaves.delete(promise),
    () => pendingAutosaves.delete(promise)
  );
  return promise;
};

export const flushOperationAutosaves = async () => {
  while (pendingAutosaves.size > 0) {
    await Promise.allSettled(Array.from(pendingAutosaves));
  }
};
