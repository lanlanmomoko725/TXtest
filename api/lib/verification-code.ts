import { randomInt, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { normalizeEmail } from "./identity";
import { getAffectedRows, requireSingleAffectedRow } from "./db-result";

export type VerificationPurpose =
  | "register"
  | "reset_password"
  | "bind_email"
  | "bind_email_old"
  | "bind_email_new"
  | "recovery_new_email";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const DUMMY_CODE_SECRET = "verification-code-sentinel-v1";
const DUMMY_CODE_HASH = "$2b$10$A7ut5UAFCQ.rDhPGkvRXVuHKs58ixFLk.KkxuhkOK2XK9uuS11kPm";

type VerificationCodeExecutor = Pick<ReturnType<typeof getDb>, "update">;

function makeCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createVerificationCode(email: string, purpose: VerificationPurpose, ip?: string) {
  const normalizedEmail = normalizeEmail(email);
  const code = makeCode();
  const secret = randomUUID();
  const codeHash = await bcrypt.hash(`${code}:${secret}`, 10);
  const storedHash = `${secret}:${codeHash}`;

  await getDb()
    .update(schema.verificationCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.verificationCodes.email, normalizedEmail),
        eq(schema.verificationCodes.purpose, purpose),
        isNull(schema.verificationCodes.consumedAt),
      ),
    );

  await getDb().insert(schema.verificationCodes).values({
    email: normalizedEmail,
    purpose,
    codeHash: storedHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
    attempts: 0,
    ip: ip ?? null,
    createdAt: new Date(),
  });

  return code;
}

export async function verifyEmailCode(email: string, purpose: VerificationPurpose, code: string) {
  const normalizedEmail = normalizeEmail(email);
  const [record] = await getDb()
    .select()
    .from(schema.verificationCodes)
    .where(
      and(
        eq(schema.verificationCodes.email, normalizedEmail),
        eq(schema.verificationCodes.purpose, purpose),
        isNull(schema.verificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(schema.verificationCodes.createdAt))
    .limit(1);

  if (!record) {
    await bcrypt.compare(`${code}:${DUMMY_CODE_SECRET}`, DUMMY_CODE_HASH);
    throw new Error("验证码无效或已过期。");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await consumeVerificationCode(record.id);
    throw new Error("验证码无效或已过期。");
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await consumeVerificationCode(record.id);
    throw new Error("验证码错误次数过多，请重新获取验证码。");
  }

  const [secret, ...hashParts] = record.codeHash.split(":");
  const hash = hashParts.join(":");
  const valid = secret && hash ? await bcrypt.compare(`${code}:${secret}`, hash) : false;
  if (!valid) {
    const result = await getDb()
      .update(schema.verificationCodes)
      .set({
        attempts: sql`${schema.verificationCodes.attempts} + 1`,
        consumedAt: sql`case when ${schema.verificationCodes.attempts} + 1 >= ${MAX_VERIFY_ATTEMPTS} then current_timestamp else ${schema.verificationCodes.consumedAt} end`,
      })
      .where(and(eq(schema.verificationCodes.id, record.id), isNull(schema.verificationCodes.consumedAt)));
    if (getAffectedRows(result) !== 1) throw new Error("验证码无效或已过期。");
    throw new Error("验证码不正确。");
  }

  return record;
}

export async function consumeVerificationCode(id: number, executor: VerificationCodeExecutor = getDb()) {
  const result = await executor
    .update(schema.verificationCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.verificationCodes.id, id), isNull(schema.verificationCodes.consumedAt)));
  requireSingleAffectedRow(result, "验证码无效、已过期或已使用。");
}

export function verificationSubject(purpose: VerificationPurpose) {
  if (purpose === "reset_password") return "天象志密码重置验证码";
  if (purpose === "bind_email" || purpose === "bind_email_new") return "天象志新邮箱验证码";
  if (purpose === "bind_email_old") return "天象志身份验证验证码";
  if (purpose === "recovery_new_email") return "天象志账号恢复验证码";
  return "天象志邮箱验证码";
}

export function verificationTemplateLabel(purpose: VerificationPurpose) {
  if (purpose === "reset_password") return "重置密码";
  if (purpose === "bind_email" || purpose === "bind_email_new") return "验证新邮箱";
  if (purpose === "bind_email_old") return "确认当前邮箱";
  if (purpose === "recovery_new_email") return "恢复账号";
  return "验证邮箱";
}
