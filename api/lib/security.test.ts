import { describe, expect, it } from "vitest";
import type { User } from "@db/schema";
import { sanitizeHtml } from "@contracts/html-sanitizer";
import { detectImageFormat, extensionForFormat } from "./upload-validation";
import { toAdminUser, toCurrentUser, toPublicUser } from "./user-dto";

const user = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
  password: "hashed-password",
  avatar: "/uploads/avatar.jpg",
  role: "admin",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  lastSignInAt: new Date("2026-01-03T00:00:00Z"),
} satisfies User;

describe("user DTOs", () => {
  it("omits password from every outbound user shape", () => {
    expect(toPublicUser(user)).not.toHaveProperty("password");
    expect(toCurrentUser(user)).not.toHaveProperty("password");
    expect(toAdminUser(user)).not.toHaveProperty("password");
  });

  it("omits email from public author shapes", () => {
    expect(toPublicUser(user)).not.toHaveProperty("email");
    expect(toCurrentUser(user)).toHaveProperty("email", "ada@example.com");
  });
});

describe("HTML sanitizer", () => {
  it("removes executable markup and unsafe URLs", () => {
    const html = sanitizeHtml(
      '<p onclick="alert(1)">hello<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)"><a href="javascript:alert(1)">bad</a></p>',
    );

    expect(html).toContain("<p>hello");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });

  it("keeps allowed rich text and upload images", () => {
    const html = sanitizeHtml('<figure style="text-align:center"><img src="/uploads/a.jpg" alt="sky"></figure>');

    expect(html).toContain("<figure");
    expect(html).toContain('src="/uploads/a.jpg"');
    expect(html).toContain("text-align: center");
  });
});

describe("upload validation", () => {
  it("detects image magic bytes instead of trusting MIME types", () => {
    expect(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe("jpg");
    expect(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
    expect(detectImageFormat(Buffer.from("not-image"))).toBeNull();
  });

  it("normalizes HEIF output extension to jpg", () => {
    expect(extensionForFormat("heif")).toBe("jpg");
    expect(extensionForFormat("webp")).toBe("webp");
  });
});
