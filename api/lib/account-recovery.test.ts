import { describe, expect, it } from "vitest";
import { normalizeRecoveryCode, recoveryCodeHash } from "./account-security";
import { assertFinalReviewPolicy, maskRecoveryContact, normalizeRecoveryContact } from "./account-recovery";

describe("account recovery policy", () => {
  it("normalizes and hashes formatted recovery codes consistently", () => {
    expect(normalizeRecoveryCode("abcd-1234 efgh")).toBe("ABCD1234EFGH");
    expect(recoveryCodeHash("ABCD-1234-EFGH")).toBe(recoveryCodeHash("abcd1234efgh"));
  });

  it("normalizes and masks recovery contacts", () => {
    expect(normalizeRecoveryContact("email", " User@Example.COM ")).toBe("user@example.com");
    expect(normalizeRecoveryContact("phone", "+86 138-0013-8000")).toBe("13800138000");
    expect(maskRecoveryContact("email", "user@example.com")).toBe("us***@example.com");
    expect(maskRecoveryContact("phone", "13800138000")).toBe("138****8000");
  });

  it("rejects final review during cooldown or by the initial reviewer", () => {
    const now = new Date("2026-07-13T12:00:00Z");
    expect(() => assertFinalReviewPolicy({
      availableAt: new Date("2026-07-13T12:00:01Z"),
      initialReviewerId: 1,
      finalReviewerId: 2,
      now,
    })).toThrow("72 小时冷静期尚未结束");
    expect(() => assertFinalReviewPolicy({
      availableAt: new Date("2026-07-13T11:59:59Z"),
      initialReviewerId: 1,
      finalReviewerId: 1,
      now,
    })).toThrow("终审必须由不同账号完成");
    expect(() => assertFinalReviewPolicy({
      availableAt: new Date("2026-07-13T11:59:59Z"),
      initialReviewerId: 1,
      finalReviewerId: 2,
      now,
    })).not.toThrow();
  });
});
