import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { normalizeEmail, normalizePhone, privateValueHash } from "./identity";

export type StepUpAction = "bind_email" | "bind_phone" | "recovery_codes";
export type StepUpMethod = "password" | "email" | "phone";

const STEP_UP_TTL_MS = 10 * 60 * 1000;

export function normalizeStepUpTarget(action: StepUpAction, target: string) {
  if (action === "bind_email") return normalizeEmail(target);
  if (action === "bind_phone") return normalizePhone(target);
  return "recovery_codes";
}

export function hashStepUpTarget(action: StepUpAction, target: string) {
  return privateValueHash(`step-up:${action}`, normalizeStepUpTarget(action, target));
}

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(namespace: string, token: string) {
  return privateValueHash(namespace, token.trim());
}

export async function createStepUpGrant(params: {
  userId: number;
  action: StepUpAction;
  target: string;
  method: StepUpMethod;
}) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + STEP_UP_TTL_MS);
  await getDb().insert(schema.stepUpGrants).values({
    tokenHash: hashOpaqueToken("step-up-token", token),
    userId: params.userId,
    action: params.action,
    targetHash: hashStepUpTarget(params.action, params.target),
    method: params.method,
    expiresAt,
    createdAt: new Date(),
  });
  return { token, expiresAt };
}

export async function assertStepUpGrant(params: {
  token: string;
  userId: number;
  action: StepUpAction;
  target: string;
}) {
  const [grant] = await getDb()
    .select()
    .from(schema.stepUpGrants)
    .where(
      and(
        eq(schema.stepUpGrants.tokenHash, hashOpaqueToken("step-up-token", params.token)),
        eq(schema.stepUpGrants.userId, params.userId),
        eq(schema.stepUpGrants.action, params.action),
        eq(schema.stepUpGrants.targetHash, hashStepUpTarget(params.action, params.target)),
        isNull(schema.stepUpGrants.consumedAt),
        gt(schema.stepUpGrants.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!grant) throw new Error("身份验证已失效，请重新验证。");
  return grant;
}

export async function consumeStepUpGrant(params: {
  token: string;
  userId: number;
  action: StepUpAction;
  target: string;
}) {
  const grant = await assertStepUpGrant(params);
  const result = await getDb()
    .update(schema.stepUpGrants)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.stepUpGrants.id, grant.id), isNull(schema.stepUpGrants.consumedAt)));
  const header = Array.isArray(result) ? result[0] : result;
  const affectedRows = header && typeof header === "object" && "affectedRows" in header
    ? Number((header as { affectedRows: unknown }).affectedRows)
    : 0;
  if (affectedRows !== 1) throw new Error("身份验证已被使用，请重新验证。");
  return grant;
}

function formatRecoveryCode(raw: string) {
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

export function normalizeRecoveryCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function recoveryCodeHash(code: string) {
  return hashOpaqueToken("recovery-code", normalizeRecoveryCode(code));
}

export async function regenerateRecoveryCodes(userId: number) {
  const codes = Array.from({ length: 8 }, () => formatRecoveryCode(randomBytes(10).toString("hex").toUpperCase()));
  await getDb().transaction(async (tx) => {
    const [user] = await tx.select({
      role: schema.users.role,
      level: schema.users.level,
      deletedAt: schema.users.deletedAt,
    }).from(schema.users).where(eq(schema.users.id, userId)).for("update");
    if (!user || user.deletedAt || user.role !== "user" || user.level >= 99) {
      throw new Error("管理员账号必须通过线下运维流程恢复。");
    }
    await tx.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, userId));
    await tx.insert(schema.recoveryCodes).values(
      codes.map((code) => ({
        userId,
        codeHash: recoveryCodeHash(code),
        createdAt: new Date(),
      })),
    );
  });
  return codes;
}

export async function consumeRecoveryCode(userId: number, code: string) {
  const codeHash = recoveryCodeHash(code);
  const [record] = await getDb()
    .select()
    .from(schema.recoveryCodes)
    .where(
      and(
        eq(schema.recoveryCodes.userId, userId),
        eq(schema.recoveryCodes.codeHash, codeHash),
        isNull(schema.recoveryCodes.consumedAt),
      ),
    )
    .limit(1);
  if (!record) throw new Error("恢复码无效或已使用。");
  const result = await getDb()
    .update(schema.recoveryCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.recoveryCodes.id, record.id), isNull(schema.recoveryCodes.consumedAt)));
  const header = Array.isArray(result) ? result[0] : result;
  const affectedRows = header && typeof header === "object" && "affectedRows" in header
    ? Number((header as { affectedRows: unknown }).affectedRows)
    : 0;
  if (affectedRows !== 1) throw new Error("恢复码无效或已使用。");
  return record;
}
