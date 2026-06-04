import * as CaptchaSdk from "@alicloud/captcha20230305";
import * as OpenApiCore from "@alicloud/openapi-core";
import { env } from "./env";

type CaptchaRegion = "cn" | "sgp";

type CaptchaResult = {
  verifyResult?: boolean;
  verifyCode?: string;
};

type CaptchaResponseBody = {
  success?: boolean;
  requestId?: string;
  code?: string;
  message?: string;
  result?: CaptchaResult;
};

type CaptchaResponse = {
  body?: CaptchaResponseBody;
};

type CaptchaClientLike = {
  verifyIntelligentCaptcha(request: unknown): Promise<CaptchaResponse>;
};

type Constructor<T> = new (config: unknown) => T;

type CaptchaSdkConstructors = {
  CaptchaClient: Constructor<CaptchaClientLike>;
  VerifyIntelligentCaptchaRequest: Constructor<unknown>;
  OpenApiConfig: Constructor<unknown>;
};

const CAPTCHA_ENDPOINTS: Record<CaptchaRegion, string> = {
  cn: "captcha.cn-shanghai.aliyuncs.com",
  sgp: "captcha.ap-southeast-1.aliyuncs.com",
};

const CAPTCHA_NOT_CONFIGURED_MESSAGE = "人机验证服务尚未配置。";
const CAPTCHA_FAILED_MESSAGE = "人机验证失败，请稍后重试。";
const CAPTCHA_REJECTED_MESSAGE = "人机验证未通过，请重新验证。";
const CAPTCHA_SDK_EXPORT_MESSAGE = "阿里云验证码 SDK 导出形态不受支持。";

let captchaClient: CaptchaClientLike | null = null;
let captchaClientCacheKey = "";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && (typeof value === "object" || typeof value === "function");
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asConstructor<T>(value: unknown): Constructor<T> | null {
  return typeof value === "function" ? (value as Constructor<T>) : null;
}

function firstConstructor<T>(values: unknown[]): Constructor<T> | null {
  for (const value of values) {
    const ctor = asConstructor<T>(value);
    if (ctor) return ctor;
  }
  return null;
}

export function resolveAliyunCaptchaSdk(
  captchaSdk: unknown = CaptchaSdk,
  openApiCore: unknown = OpenApiCore,
): CaptchaSdkConstructors {
  const captcha = record(captchaSdk);
  const captchaDefault = record(captcha.default);
  const captchaDoubleDefault = record(captchaDefault.default);
  const openApi = record(openApiCore);
  const openApiDefault = record(openApi.default);
  const openApiUtil = record(openApi.$OpenApiUtil || openApiDefault.$OpenApiUtil);

  const CaptchaClient = firstConstructor<CaptchaClientLike>([
    captcha.default,
    captchaDefault.default,
    captchaDoubleDefault.default,
    captchaSdk,
  ]);
  const VerifyIntelligentCaptchaRequest = firstConstructor<unknown>([
    captcha.VerifyIntelligentCaptchaRequest,
    captchaDefault.VerifyIntelligentCaptchaRequest,
    captchaDoubleDefault.VerifyIntelligentCaptchaRequest,
  ]);
  const OpenApiConfig = firstConstructor<unknown>([openApiUtil.Config]);

  if (!CaptchaClient || !VerifyIntelligentCaptchaRequest || !OpenApiConfig) {
    throw new Error(CAPTCHA_SDK_EXPORT_MESSAGE);
  }

  return {
    CaptchaClient,
    VerifyIntelligentCaptchaRequest,
    OpenApiConfig,
  };
}

function isCaptchaConfigured() {
  return Boolean(
    env.aliyunCaptchaSceneId &&
      env.aliyunCaptchaPrefix &&
      env.alibabaCloudAccessKeyId &&
      env.alibabaCloudAccessKeySecret,
  );
}

function captchaEndpoint() {
  return env.aliyunCaptchaEndpoint || CAPTCHA_ENDPOINTS[env.aliyunCaptchaRegion];
}

function getCaptchaClient() {
  const cacheKey = [
    env.alibabaCloudAccessKeyId,
    env.alibabaCloudAccessKeySecret,
    captchaEndpoint(),
  ].join("|");

  if (captchaClient && captchaClientCacheKey === cacheKey) {
    return captchaClient;
  }

  const { CaptchaClient, OpenApiConfig } = resolveAliyunCaptchaSdk();
  captchaClient = new CaptchaClient(new OpenApiConfig({
    accessKeyId: env.alibabaCloudAccessKeyId,
    accessKeySecret: env.alibabaCloudAccessKeySecret,
    endpoint: captchaEndpoint(),
    readTimeout: 5000,
    connectTimeout: 3000,
  }));
  captchaClientCacheKey = cacheKey;
  return captchaClient;
}

export function getCaptchaClientConfig() {
  const configured = isCaptchaConfigured();
  return {
    enabled: env.emailAuthEnabled,
    configured,
    sceneId: configured ? env.aliyunCaptchaSceneId : undefined,
    prefix: configured ? env.aliyunCaptchaPrefix : undefined,
    region: env.aliyunCaptchaRegion,
  };
}

export async function verifyAliyunCaptcha(captchaVerifyParam: string) {
  if (!env.emailAuthEnabled) {
    throw new Error("邮箱验证码注册暂未开放。");
  }

  if (!captchaVerifyParam.trim()) {
    throw new Error("请先完成人机验证。");
  }

  if (!isCaptchaConfigured()) {
    if (!env.isProduction && captchaVerifyParam === "dev-pass") {
      return;
    }
    throw new Error(CAPTCHA_NOT_CONFIGURED_MESSAGE);
  }

  try {
    const { VerifyIntelligentCaptchaRequest } = resolveAliyunCaptchaSdk();
    const response = await getCaptchaClient().verifyIntelligentCaptcha(
      new VerifyIntelligentCaptchaRequest({
        captchaVerifyParam,
        sceneId: env.aliyunCaptchaSceneId,
      }),
    );

    const body = response.body;
    if (!body?.success) {
      console.error("[captcha] API call failed", {
        requestId: body?.requestId,
        code: body?.code,
        message: body?.message,
        verifyCode: body?.result?.verifyCode,
      });
      throw new Error(CAPTCHA_FAILED_MESSAGE);
    }

    if (!body.result?.verifyResult) {
      console.error("[captcha] verification rejected", {
        requestId: body.requestId,
        verifyCode: body.result?.verifyCode,
      });
      throw new Error(CAPTCHA_REJECTED_MESSAGE);
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === CAPTCHA_FAILED_MESSAGE || err.message === CAPTCHA_REJECTED_MESSAGE)
    ) {
      throw err;
    }

    const apiError = err as {
      code?: string;
      message?: string;
      data?: {
        RequestId?: string;
        Code?: string;
        Message?: string;
      };
    };
    console.error("[captcha] SDK call failed", {
      requestId: apiError.data?.RequestId,
      code: apiError.code || apiError.data?.Code,
      message: apiError.message || apiError.data?.Message,
    });
    throw new Error(CAPTCHA_FAILED_MESSAGE);
  }
}
