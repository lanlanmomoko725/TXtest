import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  affectedRows: 1,
  records: [] as Array<Record<string, unknown>>,
  setValues: null as Record<string, unknown> | null,
  where: vi.fn(),
}));

vi.mock("../queries/connection", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: async () => mocks.records }),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mocks.setValues = values;
        return { where: mocks.where };
      },
    }),
  }),
}));

import { consumeVerificationCode, verifyEmailCode } from "./verification-code";

afterEach(() => vi.restoreAllMocks());

describe("verification code consumption", () => {
  beforeEach(() => {
    mocks.affectedRows = 1;
    mocks.records = [];
    mocks.setValues = null;
    mocks.where.mockReset();
    mocks.where.mockImplementation(async () => [{ affectedRows: mocks.affectedRows }]);
  });

  it("accepts one conditional consumption and rejects a replay", async () => {
    await expect(consumeVerificationCode(12)).resolves.toBeUndefined();
    mocks.affectedRows = 0;
    await expect(consumeVerificationCode(12)).rejects.toThrow("验证码无效、已过期或已使用");
  });

  it("performs dummy bcrypt work when no active code exists", async () => {
    const compare = vi.spyOn(bcrypt, "compare");
    await expect(verifyEmailCode("missing@example.com", "reset_password", "123456"))
      .rejects.toThrow("验证码无效或已过期");
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("uses an atomic increment and consumes the fifth invalid attempt", async () => {
    const hash = await bcrypt.hash("123456:secret", 4);
    mocks.records = [{
      id: 9,
      email: "person@example.com",
      purpose: "reset_password",
      codeHash: `secret:${hash}`,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 4,
      consumedAt: null,
      ip: null,
      createdAt: new Date(),
    }];

    await expect(verifyEmailCode("person@example.com", "reset_password", "000000"))
      .rejects.toThrow("验证码不正确");
    expect(mocks.setValues?.attempts).toBeTruthy();
    expect(mocks.setValues?.consumedAt).toBeTruthy();
  });
});
