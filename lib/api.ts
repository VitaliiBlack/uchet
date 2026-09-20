import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSessionVersion } from "@/lib/credentials";

export const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export const unauthorized = () => jsonError("Unauthorized", 401);
export const badRequest = (message: string) => jsonError(message, 400);
export const notFound = (message = "Not found") => jsonError(message, 404);
export const serverError = (message = "Internal server error") =>
  jsonError(message, 500);

export const tooManyRequests = (retryAfter: number) =>
  NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );

/**
 * Returns the authenticated numeric user id, or null when there is no
 * valid session. Keeps the auth check identical across all API routes.
 */
export const getSessionUserId = async (): Promise<number | null> => {
  const session = await auth();
  const raw = session?.user?.id;
  if (!raw) {
    return null;
  }

  const userId = Number(raw);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  // Reject tokens issued before the latest session version (logout revocation).
  const currentVersion = await getSessionVersion(userId);
  if (currentVersion === null) {
    return null;
  }

  const tokenVersion = session?.sessionVersion;
  if (typeof tokenVersion !== "number" || tokenVersion !== currentVersion) {
    return null;
  }

  return userId;
};