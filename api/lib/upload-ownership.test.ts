import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<{ path: string; uploaderUserId: number; purpose: "avatar" | "content" }>,
  recordSecurityEvent: vi.fn(),
}));

vi.mock("../queries/connection", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({ where: async () => mocks.rows }),
    }),
  }),
}));

vi.mock("./env", () => ({ env: { uploadOwnershipMode: "enforce" } }));
vi.mock("./security-events", () => ({ recordSecurityEvent: mocks.recordSecurityEvent }));

import { assertUsableUploadPaths } from "./upload-ownership";

describe("upload ownership", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.recordSecurityEvent.mockReset();
  });

  it("accepts a newly registered file owned by the current user and purpose", async () => {
    mocks.rows = [{ path: "/uploads/own.jpg", uploaderUserId: 7, purpose: "content" }];
    await expect(assertUsableUploadPaths({
      paths: ["/uploads/own.jpg"], userId: 7, purpose: "content",
    })).resolves.toBeUndefined();
  });

  it("rejects another user's file, an unknown file, and a purpose mismatch", async () => {
    mocks.rows = [{ path: "/uploads/other.jpg", uploaderUserId: 8, purpose: "content" }];
    await expect(assertUsableUploadPaths({
      paths: ["/uploads/other.jpg"], userId: 7, purpose: "content",
    })).rejects.toThrow("图片不属于当前账号");
    await expect(assertUsableUploadPaths({
      paths: ["/uploads/missing.jpg"], userId: 7, purpose: "content",
    })).rejects.toThrow("图片不属于当前账号");
    mocks.rows = [{ path: "/uploads/avatar.jpg", uploaderUserId: 7, purpose: "avatar" }];
    await expect(assertUsableUploadPaths({
      paths: ["/uploads/avatar.jpg"], userId: 7, purpose: "content",
    })).rejects.toThrow("图片不属于当前账号");
  });

  it("allows an unregistered historical path only when retained in its original record", async () => {
    await expect(assertUsableUploadPaths({
      paths: ["/uploads/legacy.jpg"],
      legacyPaths: ["/uploads/legacy.jpg"],
      userId: 7,
      purpose: "content",
    })).resolves.toBeUndefined();
  });
});
