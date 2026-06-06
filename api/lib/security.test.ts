import { afterEach, describe, expect, it, vi } from "vitest";
import type { Comment, User } from "@db/schema";
import { sanitizeHtml } from "@contracts/html-sanitizer";
import { parseVideoUrl } from "@contracts/video-embed";
import { filterSafeUploadPaths, isSafeUploadPath } from "@contracts/upload-path";
import { detectImageFormat, extensionForFormat } from "./upload-validation";
import { toAdminUser, toCurrentUser, toPublicUser } from "./user-dto";
import { validatePasswordPolicy } from "./password-policy";
import { isCommentBlocked } from "./comment-filter";
import { buildCommentThreads } from "../queries/comments";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const user = {
  id: 1,
  publicId: 100001,
  name: "Ada",
  email: "ada@example.com",
  phoneHash: null,
  phoneEncrypted: null,
  password: "hashed-password",
  avatar: "/uploads/avatar.jpg",
  role: "admin",
  level: 99,
  emailVerified: true,
  phoneVerified: false,
  sessionVersion: 1,
  lockedUntil: null,
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

  it("includes public account metadata without exposing secrets", () => {
    expect(toPublicUser(user)).toMatchObject({ publicId: 100001, level: 99, role: "admin" });
    expect(toAdminUser(user)).toMatchObject({ publicId: 100001, level: 99, email: "ada@example.com" });
    expect(toAdminUser(user)).not.toHaveProperty("phoneEncrypted");
    expect(toAdminUser(user)).not.toHaveProperty("phoneHash");
  });
});

describe("password policy", () => {
  it("requires at least 8 characters with number and upper/lowercase letters", () => {
    expect(validatePasswordPolicy("short1A")).toBeTruthy();
    expect(validatePasswordPolicy("lowercase1")).toBeTruthy();
    expect(validatePasswordPolicy("UPPERCASE1")).toBeTruthy();
    expect(validatePasswordPolicy("NoNumberHere")).toBeTruthy();
    expect(validatePasswordPolicy("Strong123")).toBeNull();
  });
});

describe("comment filtering", () => {
  it("blocks comments by keyword without exposing the matched word", () => {
    expect(isCommentBlocked("This contains blockedword.", { blocklist: "blockedword" })).toBe(true);
    expect(isCommentBlocked("This contains b l o c k e d w o r d.", { blocklist: "blockedword" })).toBe(true);
    expect(isCommentBlocked("This is fine.", { blocklist: "blockedword" })).toBe(false);
  });

  it("supports optional regex patterns and ignores invalid custom patterns", () => {
    expect(isCommentBlocked("ticket-1234", { patterns: "ticket-\\d{4}" })).toBe(true);
    expect(isCommentBlocked("ticket-abcd", { patterns: "ticket-\\d{4}" })).toBe(false);
    expect(isCommentBlocked("still allowed", { patterns: "[" })).toBe(false);
  });
});

describe("comment threads", () => {
  it("keeps only two levels and preserves @ target metadata for replies to replies", () => {
    const anotherUser = {
      ...user,
      id: 2,
      publicId: 100101,
      name: "Grace",
      email: "grace@example.com",
      role: "user" as const,
      level: 0,
    } satisfies User;
    const thirdUser = {
      ...user,
      id: 3,
      publicId: 100102,
      name: "Lin",
      email: "lin@example.com",
      role: "user" as const,
      level: 0,
    } satisfies User;
    const comments = [
      {
        id: 1,
        postId: 10,
        authorId: 1,
        parentId: null,
        replyToUserId: null,
        content: "root",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
      {
        id: 2,
        postId: 10,
        authorId: 2,
        parentId: 1,
        replyToUserId: null,
        content: "reply to root",
        createdAt: new Date("2026-01-01T10:01:00Z"),
      },
      {
        id: 3,
        postId: 10,
        authorId: 3,
        parentId: 1,
        replyToUserId: 2,
        content: "reply to reply",
        createdAt: new Date("2026-01-01T10:02:00Z"),
      },
    ] satisfies Comment[];
    const authorMap = new Map([
      [1, toPublicUser(user)],
      [2, toPublicUser(anotherUser)],
      [3, toPublicUser(thirdUser)],
    ]);

    const threads = buildCommentThreads(comments, authorMap);

    expect(threads).toHaveLength(1);
    expect(threads[0].replies).toHaveLength(2);
    expect(threads[0].replies[0].replyToUser).toBeNull();
    expect(threads[0].replies[1].replyToUser?.name).toBe("Grace");
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

  it("removes external and unsafe image sources from rich text", () => {
    const html = sanitizeHtml(
      '<p><img src="https://example.com/a.jpg"><img src="/uploads/../bad.jpg"><img src="/uploads/safe.webp"></p>',
    );

    expect(html).not.toContain("https://example.com/a.jpg");
    expect(html).not.toContain("../bad.jpg");
    expect(html).toContain('src="/uploads/safe.webp"');
  });

  it("keeps Bilibili iframes and forces official-compatible iframe attributes", () => {
    const html = sanitizeHtml(
      '<figure class="video-embed"><div class="video-embed-frame"><iframe src="https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&isOutside=true&vd_source=bad" onload="alert(1)" sandbox="allow-forms" allow="camera" allowfullscreen="false" referrerpolicy="unsafe-url" loading="eager"></iframe></div><figcaption><a href="https://www.bilibili.com/video/BV1xx411c7mD" target="_blank">title</a></figcaption></figure>',
    );

    expect(html).toContain('class="video-embed"');
    expect(html).toContain('src="https://player.bilibili.com/player.html?');
    expect(html).toContain("bvid=BV1xx411c7mD");
    expect(html).toContain("autoplay=0");
    expect(html).toContain('scrolling="no"');
    expect(html).toContain('border="0"');
    expect(html).toContain('frameborder="no"');
    expect(html).toContain('framespacing="0"');
    expect(html).toContain('allow="fullscreen"');
    expect(html).toContain('allowfullscreen="true"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toContain("sandbox=");
    expect(html).not.toContain("p=1");
    expect(html).not.toContain("autoplay=1");
    expect(html).not.toContain("danmaku");
    expect(html).not.toContain("isOutside");
    expect(html).not.toContain("vd_source");
    expect(html).not.toContain("onload");
    expect(html).not.toContain("allow-forms");
    expect(html).not.toContain("camera");
  });

  it("adds official iframe attributes when a Bilibili iframe omits them", () => {
    const html = sanitizeHtml('<iframe src="https://player.bilibili.com/player.html?bvid=BV1v5411G7Ep"></iframe>');

    expect(html).toContain("bvid=BV1v5411G7Ep");
    expect(html).toContain('src="https://player.bilibili.com/player.html?');
    expect(html).toContain("autoplay=0");
    expect(html).toContain('scrolling="no"');
    expect(html).toContain('border="0"');
    expect(html).toContain('frameborder="no"');
    expect(html).toContain('framespacing="0"');
    expect(html).toContain('allow="fullscreen"');
    expect(html).toContain('allowfullscreen="true"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    expect(html).not.toContain("sandbox=");
    expect(html).not.toContain("autoplay=1");
    expect(html).not.toContain("danmaku");
  });

  it("removes unknown and Tencent iframe sources", () => {
    const unknown = sanitizeHtml('<iframe src="https://example.com/embed" onerror="alert(1)"></iframe>');
    const tencent = sanitizeHtml('<iframe src="https://v.qq.com/txp/iframe/player.html?vid=f3568ci7bm8"></iframe>');
    const mobilePlayer = sanitizeHtml(
      '<iframe src="https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=BV1v5411G7Ep"></iframe>',
    );

    expect(unknown).not.toContain("https://example.com/embed");
    expect(unknown).not.toContain("onerror");
    expect(tencent).not.toContain("v.qq.com");
    expect(mobilePlayer).not.toContain("html5mobileplayer");
  });

  it("keeps safe typography and image sizing styles", () => {
    const html = sanitizeHtml(
      '<p style="line-height:1.75;letter-spacing:0.05em;background:url(javascript:bad)">text</p><figure style="width:75%;max-width:100%;margin:12px auto"><img src="/uploads/a.jpg" style="width:100%;max-width:100%" alt=""></figure>',
    );

    expect(html).toContain("line-height: 1.75");
    expect(html).toContain("letter-spacing: 0.05em");
    expect(html).toContain("width: 75%");
    expect(html).toContain("max-width: 100%");
    expect(html).not.toContain("background");
    expect(html).not.toContain("javascript");
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
    expect(video?.embedSrc).not.toContain("autoplay=1");
    expect(video?.embedSrc).not.toContain("danmaku");
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
    expect(video?.embedSrc).toContain("https://player.bilibili.com/player.html?");
    expect(video?.embedSrc).toContain("autoplay=0");
    expect(video?.embedSrc).not.toContain("p=1");
    expect(video?.embedSrc).not.toContain("autoplay=1");
    expect(video?.embedSrc).not.toContain("danmaku");
  });

  it("builds a Bilibili player URL from an address-bar URL with tracking params", () => {
    const video = parseVideoUrl(
      "https://www.bilibili.com/video/BV1v5411G7Ep/?spm_id_from=333.1387.homepage.video_card.click&vd_source=80b709eddb9b8fd141d4f1524674bdec",
    );

    expect(video?.embedSrc).toContain("bvid=BV1v5411G7Ep");
    expect(video?.embedSrc).toContain("https://player.bilibili.com/player.html?");
    expect(video?.embedSrc).toContain("autoplay=0");
    expect(video?.embedSrc).not.toContain("p=1");
    expect(video?.embedSrc).not.toContain("autoplay=1");
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
    expect(video?.embedSrc).not.toContain("autoplay=1");
    expect(video?.embedSrc).not.toContain("danmaku");
    expect(video?.embedSrc).not.toContain("bad=1");
  });

  it("rejects the unsupported mobile Bilibili player URL", () => {
    expect(
      parseVideoUrl("https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=BV1v5411G7Ep&page=2&autoplay=1"),
    ).toBeNull();
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

  it("allows only flat uploaded image paths", () => {
    expect(isSafeUploadPath("/uploads/avatar.jpg")).toBe(true);
    expect(isSafeUploadPath("/uploads/550e8400-e29b-41d4-a716-446655440000.png")).toBe(true);
    expect(isSafeUploadPath("https://example.com/avatar.jpg")).toBe(false);
    expect(isSafeUploadPath("/uploads/../secret.jpg")).toBe(false);
    expect(isSafeUploadPath("/uploads/file.svg")).toBe(false);
    expect(filterSafeUploadPaths(["/uploads/a.jpg", "/uploads/a.jpg", "/bad.png"])).toEqual(["/uploads/a.jpg"]);
  });
});

describe("session tokens", () => {
  it("binds refresh tokens to a server-side session identifier", async () => {
    vi.resetModules();
    vi.stubEnv("APP_SECRET", "test-secret-with-at-least-thirty-two-chars");
    vi.stubEnv("DATABASE_URL", "mysql://user:pass@db:3306/skyweb");

    const { signRefreshToken, verifyRefreshToken } = await import("./session");
    const token = await signRefreshToken(1, 3, "refresh-jti");
    const claim = await verifyRefreshToken(token);

    expect(claim).toMatchObject({
      type: "refresh",
      userId: 1,
      sessionVersion: 3,
      jti: "refresh-jti",
    });
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
    vi.stubEnv("ALIYUN_CAPTCHA_SCENE_ID", "scene-test");
    vi.stubEnv("ALIYUN_CAPTCHA_PREFIX", "prefix-test");
    vi.stubEnv("ALIYUN_CAPTCHA_REGION", "cn");
    vi.stubEnv("ALIBABA_CLOUD_ACCESS_KEY_ID", "ak-test");
    vi.stubEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET", "sk-test");

    const { env } = await import("./env");

    expect(env.isProduction).toBe(true);
    expect(env.smtpHost).toBe("");
    expect(env.smtpUser).toBe("");
    expect(env.smtpPass).toBe("");
  });
});
