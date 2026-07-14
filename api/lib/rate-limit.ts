import { eq, sql } from "drizzle-orm";
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

export async function incrementRateLimitCounter(params: {
  key: string;
  windowMs: number;
}) {
  const now = new Date();
  const nextResetAt = resetDate(params.windowMs);
  const db = getDb();

  await db
    .insert(schema.rateLimitBuckets)
    .values({
      key: params.key,
      count: 1,
      resetAt: nextResetAt,
      updatedAt: now,
    })
    .onDuplicateKeyUpdate({
      set: {
        count: sql`if(${schema.rateLimitBuckets.resetAt} <= ${now}, 1, ${schema.rateLimitBuckets.count} + 1)`,
        resetAt: sql`if(${schema.rateLimitBuckets.resetAt} <= ${now}, ${nextResetAt}, ${schema.rateLimitBuckets.resetAt})`,
        updatedAt: now,
      },
    });

  const [bucket] = await db
    .select()
    .from(schema.rateLimitBuckets)
    .where(eq(schema.rateLimitBuckets.key, params.key))
    .limit(1);
  if (!bucket) throw new Error("限流计数写入失败。");
  return bucket;
}

export async function getRateLimitCounter(key: string) {
  const [bucket] = await getDb()
    .select()
    .from(schema.rateLimitBuckets)
    .where(eq(schema.rateLimitBuckets.key, key))
    .limit(1);
  if (!bucket || bucket.resetAt.getTime() <= Date.now()) return null;
  return bucket;
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
  const bucket = await incrementRateLimitCounter(params);
  if (bucket.count > params.limit) {
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

  return {
    allowed: true,
    remaining: Math.max(0, params.limit - bucket.count),
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
