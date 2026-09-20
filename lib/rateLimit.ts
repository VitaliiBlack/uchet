import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

// Best-effort in-memory limiter. On serverless (Vercel) each instance keeps
// its own map, so this slows abuse but is not a distributed guarantee.
// For hard guarantees use a shared store (Upstash/Redis) or Vercel WAF.
const buckets = new Map<string, Bucket>();

export const rateLimit = (
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { ok: true, retryAfter: 0 };
};

export const clientIp = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }

  return request.headers.get("x-real-ip") ?? "unknown";
};

export const tooManyRequests = (retryAfter: number) =>
  NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
