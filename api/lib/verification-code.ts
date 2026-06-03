import { randomInt, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq, isNull } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";

export type VerificationPurpose = "register" | "reset_password";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

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
    throw new Error("验证码无效或已过期。");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await getDb()
      .update(schema.verificationCodes)
      .set({ consumedAt: new Date() })
      .where(eq(schema.verificationCodes.id, record.id));
    throw new Error("验证码无效或已过期。");
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await getDb()
      .update(schema.verificationCodes)
      .set({ consumedAt: new Date() })
      .where(eq(schema.verificationCodes.id, record.id));
    throw new Error("验证码错误次数过多，请重新获取验证码。");
  }

  const [secret, ...hashParts] = record.codeHash.split(":");
  const hash = hashParts.join(":");
  const valid = secret && hash ? await bcrypt.compare(`${code}:${secret}`, hash) : false;
  if (!valid) {
    await getDb()
      .update(schema.verificationCodes)
      .set({ attempts: record.attempts + 1 })
      .where(eq(schema.verificationCodes.id, record.id));
    throw new Error("验证码不正确。");
  }

  return record;
}

export async function consumeVerificationCode(id: number) {
  await getDb()
    .update(schema.verificationCodes)
    .set({ consumedAt: new Date() })
    .where(eq(schema.verificationCodes.id, id));
}

export function verificationSubject(purpose: VerificationPurpose) {
  return purpose === "register" ? "天象志邮箱验证码" : "天象志密码重置验证码";
}

export function verificationTemplateLabel(purpose: VerificationPurpose) {
  return purpose === "register" ? "注册账号" : "重置密码";
}
