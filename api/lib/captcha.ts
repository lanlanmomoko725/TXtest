import CaptchaClient, { VerifyIntelligentCaptchaRequest } from "@alicloud/captcha20230305";
import { $OpenApiUtil } from "@alicloud/openapi-core";
import { env } from "./env";

type CaptchaRegion = "cn" | "sgp";

const CAPTCHA_ENDPOINTS: Record<CaptchaRegion, string> = {
  cn: "captcha.cn-shanghai.aliyuncs.com",
  sgp: "captcha.ap-southeast-1.aliyuncs.com",
};

const CAPTCHA_NOT_CONFIGURED_MESSAGE = "人机验证服务尚未配置。";
const CAPTCHA_FAILED_MESSAGE = "人机验证失败，请稍后重试。";
const CAPTCHA_REJECTED_MESSAGE = "人机验证未通过，请重新验证。";

let captchaClient: CaptchaClient | null = null;
let captchaClientCacheKey = "";

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

  captchaClient = new CaptchaClient(new $OpenApiUtil.Config({
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
