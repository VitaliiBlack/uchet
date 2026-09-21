/** Days a user may postpone changing a temporary password before it is forced. */
export const TEMP_PASSWORD_GRACE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO deadline by which a temporary password must be replaced, or null. */
export const mustChangeBy = (setAt: Date | string | null | undefined): string | null => {
  if (!setAt) {
    return null;
  }
  const time = new Date(setAt).getTime();
  if (Number.isNaN(time)) {
    return null;
  }
  return new Date(time + TEMP_PASSWORD_GRACE_DAYS * DAY_MS).toISOString();
};

/**
 * True when the user must change the password right now: either no temporary
 * password timestamp is recorded, or the grace period has already elapsed.
 */
export const isChangeOverdue = (
  setAt: Date | string | null | undefined,
  now: number = Date.now()
): boolean => {
  const deadline = mustChangeBy(setAt);
  return deadline === null || now > new Date(deadline).getTime();
};
