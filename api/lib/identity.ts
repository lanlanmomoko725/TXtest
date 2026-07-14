import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";
import { env } from "./env";

const PHONE_RE = /^1[3-9]\d{9}$/;
const CIPHER = "aes-256-gcm";

function identityKey() {
  return createHash("sha256").update(`identity:${env.appSecret}`).digest();
}

function hmacKey() {
  return createHash("sha256").update(`identity-hash:${env.appSecret}`).digest();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  const digits = phone.trim().replace(/[^\d]/g, "");
  const withoutCountry = digits.startsWith("86") && digits.length === 13 ? digits.slice(2) : digits;
  if (!PHONE_RE.test(withoutCountry)) {
    throw new Error("请输入有效的中国大陆手机号。");
  }
  return withoutCountry;
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  return `${normalized.slice(0, 3)}****${normalized.slice(7)}`;
}

export function phoneHash(phone: string) {
  const normalized = normalizePhone(phone);
  return createHmac("sha256", hmacKey()).update(`phone:${normalized}`).digest("hex");
}

export function privateValueHash(namespace: string, value: string) {
  return createHmac("sha256", hmacKey()).update(`${namespace}:${value}`).digest("hex");
}

export function encryptIdentity(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, identityKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptIdentity(payload: string | null | undefined) {
  if (!payload) return null;
  const [version, ivText, tagText, encryptedText] = payload.split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) {
    return null;
  }

  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");
  const encrypted = Buffer.from(encryptedText, "base64url");
  const decipher = createDecipheriv(CIPHER, identityKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskEncryptedPhone(phoneEncrypted: string | null | undefined) {
  const phone = decryptIdentity(phoneEncrypted);
  return phone ? maskPhone(phone) : null;
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
