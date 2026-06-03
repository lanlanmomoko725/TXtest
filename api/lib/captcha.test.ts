import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdkMock = vi.hoisted(() => ({
  clientConfigs: [] as Array<Record<string, unknown>>,
  requests: [] as Array<Record<string, unknown>>,
  verifyIntelligentCaptcha: vi.fn(),
}));

vi.mock("@alicloud/captcha20230305", () => {
  class VerifyIntelligentCaptchaRequest {
    constructor(map: Record<string, unknown>) {
      sdkMock.requests.push(map);
      Object.assign(this, map);
    }
  }

  class CaptchaClient {
    constructor(config: Record<string, unknown>) {
      sdkMock.clientConfigs.push(config);
    }

    verifyIntelligentCaptcha = sdkMock.verifyIntelligentCaptcha;
  }

  return {
    default: CaptchaClient,
    VerifyIntelligentCaptchaRequest,
  };
});

function stubRequiredEnv() {
  vi.stubEnv("APP_SECRET", "test-secret-with-at-least-thirty-two-chars");
  vi.stubEnv("DATABASE_URL", "mysql://user:pass@db:3306/skyweb");
}

function stubCaptchaEnv() {
  stubRequiredEnv();
  vi.stubEnv("EMAIL_AUTH_ENABLED", "true");
  vi.stubEnv("ALIYUN_CAPTCHA_SCENE_ID", "scene-test");
  vi.stubEnv("ALIYUN_CAPTCHA_PREFIX", "prefix-test");
  vi.stubEnv("ALIYUN_CAPTCHA_REGION", "cn");
  vi.stubEnv("ALIBABA_CLOUD_ACCESS_KEY_ID", "ak-test");
  vi.stubEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET", "sk-test");
}

beforeEach(() => {
  sdkMock.clientConfigs.length = 0;
  sdkMock.requests.length = 0;
  sdkMock.verifyIntelligentCaptcha.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("Aliyun CAPTCHA config", () => {
  it("requires full captcha config in production when email auth is enabled", async () => {
    stubRequiredEnv();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("EMAIL_AUTH_ENABLED", "true");

    await expect(import("./env")).rejects.toThrow("ALIYUN_CAPTCHA_SCENE_ID");
  });

  it("rejects client regions other than cn or sgp", async () => {
    stubCaptchaEnv();
    vi.stubEnv("ALIYUN_CAPTCHA_REGION", "cn-dual");

    await expect(import("./env")).rejects.toThrow("ALIYUN_CAPTCHA_REGION");
  });

  it("returns a configured client shape only when all captcha values are present", async () => {
    stubCaptchaEnv();
    const { getCaptchaClientConfig } = await import("./captcha");

    expect(getCaptchaClientConfig()).toEqual({
      enabled: true,
      configured: true,
      sceneId: "scene-test",
      prefix: "prefix-test",
      region: "cn",
    });
  });
});

describe("Aliyun CAPTCHA verification", () => {
  it("passes the original CaptchaVerifyParam and SceneId to the SDK", async () => {
    stubCaptchaEnv();
    const rawParam = '{"captcha":"raw value","sig":"do-not-touch"}';
    sdkMock.verifyIntelligentCaptcha.mockResolvedValue({
      body: {
        success: true,
        requestId: "request-1",
        result: { verifyResult: true },
      },
    });

    const { verifyAliyunCaptcha } = await import("./captcha");
    await expect(verifyAliyunCaptcha(rawParam)).resolves.toBeUndefined();

    expect(sdkMock.clientConfigs[0]).toMatchObject({
      accessKeyId: "ak-test",
      accessKeySecret: "sk-test",
      endpoint: "captcha.cn-shanghai.aliyuncs.com",
    });
    expect(sdkMock.requests[0]).toEqual({
      captchaVerifyParam: rawParam,
      sceneId: "scene-test",
    });
  });

  it("rejects when the SDK reports a failed API call", async () => {
    stubCaptchaEnv();
    sdkMock.verifyIntelligentCaptcha.mockResolvedValue({
      body: {
        success: false,
        requestId: "request-2",
        code: "InternalError",
        message: "failed",
      },
    });

    const { verifyAliyunCaptcha } = await import("./captcha");
    await expect(verifyAliyunCaptcha("captcha-param")).rejects.toThrow("人机验证失败");
  });

  it("rejects when Aliyun returns a failed verification result", async () => {
    stubCaptchaEnv();
    sdkMock.verifyIntelligentCaptcha.mockResolvedValue({
      body: {
        success: true,
        requestId: "request-3",
        result: { verifyResult: false, verifyCode: "F008" },
      },
    });

    const { verifyAliyunCaptcha } = await import("./captcha");
    await expect(verifyAliyunCaptcha("captcha-param")).rejects.toThrow("人机验证未通过");
  });

  it("keeps dev-pass available only when captcha is not configured outside production", async () => {
    stubRequiredEnv();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_AUTH_ENABLED", "true");

    const { verifyAliyunCaptcha } = await import("./captcha");
    await expect(verifyAliyunCaptcha("dev-pass")).resolves.toBeUndefined();
    expect(sdkMock.verifyIntelligentCaptcha).not.toHaveBeenCalled();
  });
});
