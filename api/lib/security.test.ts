import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@db/schema";
import { sanitizeHtml } from "@contracts/html-sanitizer";
import { parseVideoUrl } from "@contracts/video-embed";
import { detectImageFormat, extensionForFormat } from "./upload-validation";
import { toAdminUser, toCurrentUser, toPublicUser } from "./user-dto";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

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

  it("keeps Bilibili iframes and forces official-compatible iframe attributes", () => {
    const html = sanitizeHtml(
      '<figure class="video-embed"><div class="video-embed-frame"><iframe src="https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&isOutside=true&vd_source=bad" onload="alert(1)" sandbox="allow-forms" allow="camera" allowfullscreen="false" referrerpolicy="unsafe-url" loading="eager"></iframe></div><figcaption><a href="https://www.bilibili.com/video/BV1xx411c7mD" target="_blank">title</a></figcaption></figure>',
    );

    expect(html).toContain('class="video-embed"');
    expect(html).toContain('src="https://player.bilibili.com/player.html?');
    expect(html).toContain("bvid=BV1xx411c7mD");
    expect(html).toContain("p=1");
    expect(html).toContain("autoplay=0");
    expect(html).toContain("danmaku=0");
    expect(html).toContain('scrolling="no"');
    expect(html).toContain('border="0"');
    expect(html).toContain('frameborder="no"');
    expect(html).toContain('framespacing="0"');
    expect(html).toContain('allowfullscreen="true"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain("isOutside");
    expect(html).not.toContain("vd_source");
    expect(html).not.toContain("onload");
    expect(html).not.toContain("sandbox");
    expect(html).not.toContain("allow-forms");
    expect(html).not.toContain("camera");
    expect(html).not.toContain("referrerpolicy");
  });

  it("adds official iframe attributes when a Bilibili iframe omits them", () => {
    const html = sanitizeHtml('<iframe src="https://player.bilibili.com/player.html?bvid=BV1v5411G7Ep"></iframe>');

    expect(html).toContain("bvid=BV1v5411G7Ep");
    expect(html).toContain("autoplay=0");
    expect(html).toContain("danmaku=0");
    expect(html).toContain('scrolling="no"');
    expect(html).toContain('border="0"');
    expect(html).toContain('frameborder="no"');
    expect(html).toContain('framespacing="0"');
    expect(html).toContain('allowfullscreen="true"');
    expect(html).toContain('loading="lazy"');
  });

  it("removes unknown and Tencent iframe sources", () => {
    const unknown = sanitizeHtml('<iframe src="https://example.com/embed" onerror="alert(1)"></iframe>');
    const tencent = sanitizeHtml('<iframe src="https://v.qq.com/txp/iframe/player.html?vid=f3568ci7bm8"></iframe>');

    expect(unknown).not.toContain("https://example.com/embed");
    expect(unknown).not.toContain("onerror");
    expect(tencent).not.toContain("v.qq.com");
  });
});

describe("video URL parser", () => {
  it("builds a Bilibili player URL from a standard video page", () => {
    const video = parseVideoUrl("https://www.bilibili.com/video/BV1xx411c7mD/?p=2", "\u6d4b\u8bd5\u89c6\u9891");

    expect(video).toMatchObject({
      platform: "bilibili",
      title: "\u6d4b\u8bd5\u89c6\u9891",
      originalUrl: "https://www.bilibili.com/video/BV1xx411c7mD/?p=2",
    });
    expect(video?.embedSrc).toContain("https://player.bilibili.com/player.html?");
    expect(video?.embedSrc).toContain("bvid=BV1xx411c7mD");
    expect(video?.embedSrc).toContain("p=2");
    expect(video?.embedSrc).toContain("autoplay=0");
    expect(video?.embedSrc).toContain("danmaku=0");
    expect(video?.embedSrc).not.toContain("isOutside");
  });

  it("extracts a Bilibili URL and title from shared text", () => {
    const video = parseVideoUrl(
      "\u3010\u3010\u5929\u8c61\u7231\u597d\u8005\u3011\u98ce\u66b4\u4e4b\u7f8e\u2014\u2014\u79d1\u5b66\u7684\u8ffd\u98ce\u9010\u96e8\u3011 https://www.bilibili.com/video/BV1v5411G7Ep/?share_source=copy_web&vd_source=eed6f6d8cd3b681920ae4aeb9e0863a3",
    );

    expect(video).toMatchObject({
      platform: "bilibili",
      title:
        "\u3010\u5929\u8c61\u7231\u597d\u8005\u3011\u98ce\u66b4\u4e4b\u7f8e\u2014\u2014\u79d1\u5b66\u7684\u8ffd\u98ce\u9010\u96e8",
      originalUrl:
        "https://www.bilibili.com/video/BV1v5411G7Ep/?share_source=copy_web&vd_source=eed6f6d8cd3b681920ae4aeb9e0863a3",
    });
    expect(video?.embedSrc).toContain("bvid=BV1v5411G7Ep");
    expect(video?.embedSrc).toContain("p=1");
  });

  it("builds a Bilibili player URL from an address-bar URL with tracking params", () => {
    const video = parseVideoUrl(
      "https://www.bilibili.com/video/BV1v5411G7Ep/?spm_id_from=333.1387.homepage.video_card.click&vd_source=80b709eddb9b8fd141d4f1524674bdec",
    );

    expect(video?.embedSrc).toContain("bvid=BV1v5411G7Ep");
    expect(video?.embedSrc).toContain("p=1");
    expect(video?.embedSrc).not.toContain("spm_id_from");
    expect(video?.embedSrc).not.toContain("vd_source");
    expect(video?.embedSrc).not.toContain("isOutside");
  });

  it("normalizes an official Bilibili player URL", () => {
    const video = parseVideoUrl(
      "https://player.bilibili.com/player.html?bvid=BV1v5411G7Ep&p=3&autoplay=1&bad=1",
    );

    expect(video?.embedSrc).toContain("bvid=BV1v5411G7Ep");
    expect(video?.embedSrc).toContain("p=3");
    expect(video?.embedSrc).toContain("autoplay=0");
    expect(video?.embedSrc).toContain("danmaku=0");
    expect(video?.embedSrc).not.toContain("bad=1");
  });

  it("rejects unsafe, unsupported, and Tencent URLs", () => {
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
    expect(parseVideoUrl("https://b23.tv/abc")).toBeNull();
    expect(parseVideoUrl("https://example.com/video/1")).toBeNull();
    expect(parseVideoUrl("https://v.qq.com/x/page/f3568ci7bm8.html?url_from=share")).toBeNull();
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

describe("environment config", () => {
  it("does not require SMTP settings for production boot", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_SECRET", "test-secret-with-at-least-thirty-two-chars");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@db:3306/skyweb");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");

    const { env } = await import("./env");

    expect(env.isProduction).toBe(true);
    expect(env.smtpHost).toBe("");
    expect(env.smtpUser).toBe("");
    expect(env.smtpPass).toBe("");
  });
});
