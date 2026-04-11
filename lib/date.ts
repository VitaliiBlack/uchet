const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

const pad = (value: number) => String(value).padStart(2, "0");

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const getTodayDateKey = () => formatDateKey(new Date());

export const normalizeDateKey = (value: string | Date) => {
  if (value instanceof Date) {
    return formatDateKey(value);
  }

  const match = value.match(DATE_KEY_PATTERN);
  if (match) {
    return match[0];
  }

  return formatDateKey(new Date(value));
};

export const parseDateKey = (value: string) => {
  const match = value.match(DATE_KEY_PATTERN);
  if (!match) {
    return new Date(value);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};
