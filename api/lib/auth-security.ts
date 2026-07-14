import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { privateValueHash } from "./identity";
import { rateLimitKey } from "./rate-limit";

export const LOGIN_FAILURE_WINDOW_MS = 30 * 60 * 1000;
export const LOGIN_CAPTCHA_THRESHOLD = 5;
export const LOGIN_PAIR_FAILURE_LIMIT = 10;
export const LOGIN_IP_ATTEMPT_LIMIT = 40;
export const DUMMY_PASSWORD_HASH = "$2b$10$Ww/Z5e4Ts0PxSUKb9RDjQeieeMs/Mu99uDpa7hIs5rWEUEHVl8/9m";

export function loginAccountSubject(loginKey: string) {
  return privateValueHash("password-login", loginKey);
}

export function loginFailureKeys(subjectHash: string, ip: string) {
  return {
    account: rateLimitKey("login-failure", "account", subjectHash),
    pair: rateLimitKey("login-failure", "pair", subjectHash, "ip", ip),
  };
}

export function requiresLoginCaptcha(failureCount: number) {
  return failureCount >= LOGIN_CAPTCHA_THRESHOLD;
}

export function compareLoginPassword(password: string, passwordHash?: string | null) {
  return bcrypt.compare(password, passwordHash || DUMMY_PASSWORD_HASH);
}

export function isLoginPasswordAccepted(passwordHash: string | null | undefined, bcryptMatched: boolean) {
  return Boolean(passwordHash) && bcryptMatched;
}

export async function waitForUniformAuthResponse(startedAt: number, minimumMs = 350, jitterMs = 100) {
  const targetMs = minimumMs + randomInt(0, jitterMs + 1);
  const remainingMs = targetMs - (Date.now() - startedAt);
  if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
}
