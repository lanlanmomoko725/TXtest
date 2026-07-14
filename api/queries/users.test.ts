import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  deletes: [] as unknown[],
  user: {
    id: 7,
    publicId: 100007,
    sessionVersion: 3,
    deletedAt: null,
  },
}));

vi.mock("./connection", () => ({
  getDb: () => ({
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [mocks.user] }) }) }),
        update: (table: unknown) => ({
          set: (values: Record<string, unknown>) => ({
            where: async () => {
              mocks.updates.push({ table, values });
              return [{ affectedRows: 1 }];
            },
          }),
        }),
        delete: (table: unknown) => ({
          where: async () => {
            mocks.deletes.push(table);
            return [{ affectedRows: 1 }];
          },
        }),
      };
      return callback(tx);
    },
  }),
}));

import { deleteUser } from "./users";

describe("user soft deletion", () => {
  beforeEach(() => {
    mocks.updates = [];
    mocks.deletes = [];
  });

  it("anonymizes credentials, invalidates sessions, and keeps the user row", async () => {
    await deleteUser(7, 99, "用户申请注销");
    const userUpdate = mocks.updates[0]?.values;
    expect(userUpdate).toMatchObject({
      name: "已注销用户-100007",
      email: null,
      phoneHash: null,
      phoneEncrypted: null,
      password: null,
      avatar: null,
      role: "user",
      level: 0,
      sessionVersion: 4,
      deletedBy: 99,
      deletionReason: "用户申请注销",
    });
    expect(userUpdate?.deletedAt).toBeInstanceOf(Date);
    expect(mocks.updates.some((entry) => entry.values.revokedAt instanceof Date)).toBe(true);
    expect(mocks.updates.some((entry) => entry.values.status === "cancelled")).toBe(true);
    expect(mocks.deletes.length).toBe(2);
  });
});
