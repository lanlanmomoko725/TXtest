import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateWhere: vi.fn(),
  insertValues: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../queries/connection", () => ({
  getDb: () => ({ transaction: mocks.transaction }),
}));

vi.mock("./session", () => ({
  signAccessToken: vi.fn(async () => "access-token"),
  signRefreshToken: vi.fn(async (_userId: number, _sessionVersion: number, jti: string) => `refresh:${jti}`),
}));

import { rotateRefreshSession } from "./sessions";

describe("refresh session rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        update: () => ({
          set: () => ({ where: mocks.updateWhere }),
        }),
        insert: () => ({ values: mocks.insertValues }),
      }),
    );
  });

  it("creates replacement tokens only when the old session is consumed once", async () => {
    mocks.updateWhere
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const input = {
      userId: 1,
      sessionVersion: 3,
      jti: "old-session",
      headers: new Headers({ "x-real-ip": "203.0.113.9" }),
    };

    const first = await rotateRefreshSession(input);
    const replay = await rotateRefreshSession(input);

    expect(first?.accessToken).toBe("access-token");
    expect(first?.refreshToken).toMatch(/^refresh:/);
    expect(replay).toBeNull();
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
  });
});
