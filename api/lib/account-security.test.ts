import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  affectedRows: 1,
}));

vi.mock("../queries/connection", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ id: 11, userId: 7 }] }),
      }),
    }),
    update: () => ({
      set: () => ({ where: async () => [{ affectedRows: mocks.affectedRows }] }),
    }),
  }),
}));

import { consumeRecoveryCode } from "./account-security";

describe("recovery code consumption", () => {
  beforeEach(() => {
    mocks.affectedRows = 1;
  });

  it("accepts one atomic consumption and rejects a replay race", async () => {
    await expect(consumeRecoveryCode(7, "ABCD-1234")).resolves.toMatchObject({ id: 11, userId: 7 });
    mocks.affectedRows = 0;
    await expect(consumeRecoveryCode(7, "ABCD-1234")).rejects.toThrow("恢复码无效或已使用");
  });
});
