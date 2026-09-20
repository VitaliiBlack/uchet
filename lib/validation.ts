const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeEmail = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

export const isValidEmail = (value: string): boolean =>
  value.length > 0 && value.length <= 254 && EMAIL_PATTERN.test(value);

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export const isValidPassword = (value: string): boolean =>
  value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;

/** Parses an integer id; returns null for anything invalid. */
export const parsePositiveInt = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Validates a real YYYY-MM-DD calendar date without timezone shifts. */
export const isValidDateKey = (value: unknown): value is string => {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/** Mirrors the previous parseFloat(value) || 0 semantics. */
export const parseMoney = (value: unknown): number => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Trims nothing, just bounds the length and guards non-strings. */
export const sanitizeText = (value: unknown, maxLength = 2000): string =>
  typeof value === "string" ? value.slice(0, maxLength) : "";
