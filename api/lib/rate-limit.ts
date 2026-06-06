import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { recordSecurityEvent } from "./security-events";

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`请求过于频繁，请 ${Math.max(1, retryAfterSeconds)} 秒后再试。`);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function resetDate(windowMs: number) {
  return new Date(Date.now() + windowMs);
}

function secondsUntil(date: Date) {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
}

export function rateLimitKey(...parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? "unknown").trim().toLowerCase().replace(/[^a-z0-9@._:-]+/g, "_"))
    .join(":")
    .slice(0, 255);
}

export async function consumeRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  event?: string;
  subject?: string;
  ip?: string;
  userId?: number;
}) {
  const now = new Date();
  const db = getDb();

  await db
    .delete(schema.rateLimitBuckets)
    .where(and(eq(schema.rateLimitBuckets.key, params.key), lt(schema.rateLimitBuckets.resetAt, now)));

  const [bucket] = await db
    .select()
    .from(schema.rateLimitBuckets)
    .where(eq(schema.rateLimitBuckets.key, params.key))
    .limit(1);

  if (!bucket) {
    await db.insert(schema.rateLimitBuckets).values({
      key: params.key,
      count: 1,
      resetAt: resetDate(params.windowMs),
      updatedAt: now,
    });
    return { allowed: true, remaining: params.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.resetAt.getTime() <= now.getTime()) {
    await db
      .update(schema.rateLimitBuckets)
      .set({ count: 1, resetAt: resetDate(params.windowMs), updatedAt: now })
      .where(eq(schema.rateLimitBuckets.key, params.key));
    return { allowed: true, remaining: params.limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= params.limit) {
    const retryAfterSeconds = secondsUntil(bucket.resetAt);
    await recordSecurityEvent({
      event: params.event ?? "rate_limit_blocked",
      subject: params.subject ?? params.key,
      ip: params.ip,
      userId: params.userId,
      details: { key: params.key, limit: params.limit, retryAfterSeconds },
    });
    throw new RateLimitError(retryAfterSeconds);
  }

  await db
    .update(schema.rateLimitBuckets)
    .set({ count: bucket.count + 1, updatedAt: now })
    .where(eq(schema.rateLimitBuckets.key, params.key));

  return {
    allowed: true,
    remaining: Math.max(0, params.limit - bucket.count - 1),
    retryAfterSeconds: 0,
  };
}

export async function isRateLimitAvailable(params: {
  key: string;
  limit: number;
  windowMs: number;
  event?: string;
  subject?: string;
  ip?: string;
  userId?: number;
}) {
  try {
    await consumeRateLimit(params);
    return true;
  } catch (err) {
    if (err instanceof RateLimitError) return false;
    throw err;
  }
}
