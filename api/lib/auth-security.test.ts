import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_CAPTCHA_THRESHOLD,
  LOGIN_IP_ATTEMPT_LIMIT,
  LOGIN_PAIR_FAILURE_LIMIT,
  compareLoginPassword,
  isLoginPasswordAccepted,
  loginAccountSubject,
  loginFailureKeys,
  requiresLoginCaptcha,
} from "./auth-security";

afterEach(() => vi.restoreAllMocks());

describe("password login security", () => {
  it("requires CAPTCHA after five failures without hard-locking the account", () => {
    expect(LOGIN_CAPTCHA_THRESHOLD).toBe(5);
    expect(LOGIN_PAIR_FAILURE_LIMIT).toBe(10);
    expect(LOGIN_IP_ATTEMPT_LIMIT).toBe(40);
    expect(requiresLoginCaptcha(4)).toBe(false);
    expect(requiresLoginCaptcha(5)).toBe(true);
    expect(requiresLoginCaptcha(10)).toBe(true);
  });

  it("uses HMAC subjects instead of raw account identifiers in counter keys", () => {
    const identifier = "person@example.com";
    const subject = loginAccountSubject(identifier);
    const keys = loginFailureKeys(subject, "203.0.113.9");

    expect(subject).not.toContain(identifier);
    expect(keys.account).not.toContain(identifier);
    expect(keys.pair).not.toContain(identifier);
  });

  it("performs exactly one bcrypt comparison for known and unknown accounts", async () => {
    const passwordHash = await bcrypt.hash("KnownPassword1", 4);
    const compare = vi.spyOn(bcrypt, "compare");

    await expect(compareLoginPassword("KnownPassword1", passwordHash)).resolves.toBe(true);
    expect(compare).toHaveBeenCalledTimes(1);

    compare.mockClear();
    await expect(compareLoginPassword("UnknownPassword1", null)).resolves.toBe(false);
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("keeps the dummy hash isolated from accounts without a password", async () => {
    await expect(compareLoginPassword("invalid-password-sentinel-v1", null)).resolves.toBe(true);
    const bcryptMatched = await compareLoginPassword("invalid-password-sentinel-v1", null);
    expect(isLoginPasswordAccepted(null, bcryptMatched)).toBe(false);
    expect(isLoginPasswordAccepted("real-hash", true)).toBe(true);
  });
});
