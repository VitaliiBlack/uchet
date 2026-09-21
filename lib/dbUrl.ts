const POSTGRES_URL = /^postgres(ql)?:\/\//;

/**
 * Resolves the Postgres connection string.
 *
 * The Neon integration on Vercel writes a fresh connection string under a
 * prefixed name (DATABASE_URL_DATABASE_URL). Prefer it over the older manual
 * DATABASE_URL, so rotating the database password in Neon keeps working even
 * though the manual variable still holds the previous password. The remaining
 * names are fallbacks for a changed integration prefix.
 */
export const resolveDatabaseUrl = (): string | undefined => {
  const candidates = [
    process.env.DATABASE_URL_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL_POSTGRES_URL,
  ];
  return candidates.find(
    (value): value is string => typeof value === 'string' && POSTGRES_URL.test(value)
  );
};
