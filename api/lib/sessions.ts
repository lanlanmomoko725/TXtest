import { createHash, randomUUID } from "crypto";
import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { Session } from "@contracts/constants";
import { requestIp, requestUserAgent } from "./request-info";
import { signAccessToken, signRefreshToken } from "./session";

const SESSION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let expiredSessionCleanupTimer: ReturnType<typeof setInterval> | null = null;

function hashJti(jti: string) {
  return createHash("sha256").update(jti).digest("hex");
}

function getAffectedRows(result: unknown) {
  const item = Array.isArray(result) ? result[0] : result;
  if (item && typeof item === "object" && "affectedRows" in item) {
    const value = Number((item as { affectedRows: unknown }).affectedRows);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

export function newRefreshJti() {
  return randomUUID();
}

export async function cleanupExpiredSessions(now = new Date()) {
  const result = await getDb()
    .delete(schema.sessions)
    .where(lte(schema.sessions.expiresAt, now));
  return getAffectedRows(result);
}

export function startExpiredSessionCleanup(intervalMs = SESSION_CLEANUP_INTERVAL_MS) {
  if (expiredSessionCleanupTimer) return expiredSessionCleanupTimer;

  const runCleanup = async () => {
    try {
      const affectedRows = await cleanupExpiredSessions();
      if (affectedRows === undefined) {
        console.log("[sessions] Expired session cleanup completed.");
      } else {
        console.log(`[sessions] Cleaned up ${affectedRows} expired session(s).`);
      }
    } catch (error) {
      console.error("[sessions] Failed to clean up expired sessions.", error);
    }
  };

  void runCleanup();
  expiredSessionCleanupTimer = setInterval(runCleanup, intervalMs);
  expiredSessionCleanupTimer.unref();
  return expiredSessionCleanupTimer;
}

export async function createRefreshSession(params: {
  userId: number;
  jti: string;
  headers: Headers;
}) {
  const now = new Date();
  await getDb().insert(schema.sessions).values({
    userId: params.userId,
    tokenHash: hashJti(params.jti),
    ip: requestIp(params.headers),
    userAgent: requestUserAgent(params.headers),
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + Session.refreshMaxAgeMs),
  });
}

export async function createSessionTokens(params: {
  userId: number;
  sessionVersion: number;
  headers: Headers;
}) {
  const jti = newRefreshJti();
  await createRefreshSession({ userId: params.userId, jti, headers: params.headers });
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(params.userId, params.sessionVersion),
    signRefreshToken(params.userId, params.sessionVersion, jti),
  ]);
  return { accessToken, refreshToken, refreshJti: jti };
}

export async function verifyRefreshSession(params: {
  userId: number;
  jti?: string;
}) {
  if (!params.jti) return false;
  const [session] = await getDb()
    .select()
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, params.userId),
        eq(schema.sessions.tokenHash, hashJti(params.jti)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return false;
  await getDb()
    .update(schema.sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.sessions.id, session.id));
  return true;
}

export async function revokeRefreshSession(jti?: string) {
  if (!jti) return;
  await getDb()
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.sessions.tokenHash, hashJti(jti)));
}

export async function revokeAllUserSessions(userId: number) {
  await getDb()
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}

export async function rotateRefreshSession(params: {
  userId: number;
  sessionVersion: number;
  jti?: string;
  headers: Headers;
}) {
  const valid = await verifyRefreshSession({ userId: params.userId, jti: params.jti });
  if (!valid) return null;
  await revokeRefreshSession(params.jti);
  return createSessionTokens({
    userId: params.userId,
    sessionVersion: params.sessionVersion,
    headers: params.headers,
  });
}
