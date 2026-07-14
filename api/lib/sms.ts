import * as DypnsSdk from "@alicloud/dypnsapi20170525";
import * as OpenApiCore from "@alicloud/openapi-core";
import { randomUUID } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import * as schema from "@db/schema";
import { env } from "./env";
import { normalizePhone, phoneHash } from "./identity";
import { getDb } from "../queries/connection";

export type SmsPurpose =
  | "register"
  | "login"
  | "bind_phone"
  | "bind_phone_old"
  | "bind_phone_new"
  | "recovery_new_phone";

type SmsClientLike = {
  sendSmsVerifyCodeWithOptions(request: unknown, runtime: unknown): Promise<SmsSendResponse>;
  checkSmsVerifyCodeWithOptions(request: unknown, runtime: unknown): Promise<SmsCheckResponse>;
};

type SmsSendResponse = {
  body?: {
    success?: boolean;
    code?: string;
    message?: string;
    requestId?: string;
    model?: { bizId?: string; outId?: string };
  };
};

type SmsCheckResponse = {
  body?: {
    success?: boolean;
    code?: string;
    message?: string;
    requestId?: string;
    model?: { verifyResult?: string; outId?: string };
  };
};

type Constructor<T> = new (config?: unknown) => T;

type SmsSdkConstructors = {
  SmsClient: Constructor<SmsClientLike>;
  SendSmsVerifyCodeRequest: Constructor<unknown>;
  CheckSmsVerifyCodeRequest: Constructor<unknown>;
  OpenApiConfig: Constructor<unknown>;
  RuntimeOptions: Constructor<unknown>;
};

const SMS_NOT_CONFIGURED_MESSAGE = "短信验证码服务尚未配置。";
const SMS_SEND_FAILED_MESSAGE = "短信验证码发送失败，请稍后再试。";
const SMS_VERIFY_FAILED_MESSAGE = "短信验证码无效或已过期。";

let smsClient: SmsClientLike | null = null;
let smsClientCacheKey = "";

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

export function resolveAliyunSmsSdk(
  dypnsSdk: unknown = DypnsSdk,
  openApiCore: unknown = OpenApiCore,
): SmsSdkConstructors {
  const sdk = record(dypnsSdk);
  const sdkDefault = record(sdk.default);
  const sdkDoubleDefault = record(sdkDefault.default);
  const openApi = record(openApiCore);
  const openApiDefault = record(openApi.default);
  const openApiUtil = record(openApi.$OpenApiUtil || openApiDefault.$OpenApiUtil);

  const SmsClient = firstConstructor<SmsClientLike>([
    sdk.default,
    sdkDefault.default,
    sdkDoubleDefault.default,
    dypnsSdk,
  ]);
  const SendSmsVerifyCodeRequest = firstConstructor<unknown>([
    sdk.SendSmsVerifyCodeRequest,
    sdkDefault.SendSmsVerifyCodeRequest,
    sdkDoubleDefault.SendSmsVerifyCodeRequest,
  ]);
  const CheckSmsVerifyCodeRequest = firstConstructor<unknown>([
    sdk.CheckSmsVerifyCodeRequest,
    sdkDefault.CheckSmsVerifyCodeRequest,
    sdkDoubleDefault.CheckSmsVerifyCodeRequest,
  ]);
  const OpenApiConfig = firstConstructor<unknown>([openApiUtil.Config]);
  const RuntimeOptions = firstConstructor<unknown>([
    openApi.RuntimeOptions,
    openApiDefault.RuntimeOptions,
    record(openApi.$dara).RuntimeOptions,
    record(openApiDefault.$dara).RuntimeOptions,
  ]);

  if (!SmsClient || !SendSmsVerifyCodeRequest || !CheckSmsVerifyCodeRequest || !OpenApiConfig) {
    throw new Error("阿里云短信 SDK 导出形态不受支持。");
  }

  return {
    SmsClient,
    SendSmsVerifyCodeRequest,
    CheckSmsVerifyCodeRequest,
    OpenApiConfig,
    RuntimeOptions: RuntimeOptions ?? (class RuntimeOptionsFallback {}),
  };
}

export function isSmsConfigured() {
  return Boolean(
    env.smsAuthEnabled &&
      env.aliyunSmsSignName &&
      env.aliyunSmsTemplateCode &&
      env.alibabaCloudAccessKeyId &&
      env.alibabaCloudAccessKeySecret,
  );
}

function smsEndpoint() {
  return env.aliyunSmsEndpoint || "dypnsapi.aliyuncs.com";
}

function getSmsClient() {
  const cacheKey = [env.alibabaCloudAccessKeyId, env.alibabaCloudAccessKeySecret, smsEndpoint()].join("|");
  if (smsClient && smsClientCacheKey === cacheKey) {
    return smsClient;
  }

  const { SmsClient, OpenApiConfig } = resolveAliyunSmsSdk();
  smsClient = new SmsClient(
    new OpenApiConfig({
      accessKeyId: env.alibabaCloudAccessKeyId,
      accessKeySecret: env.alibabaCloudAccessKeySecret,
      endpoint: smsEndpoint(),
      readTimeout: 5000,
      connectTimeout: 3000,
    }),
  );
  smsClientCacheKey = cacheKey;
  return smsClient;
}

function templateParam() {
  return env.aliyunSmsTemplateParam || '{"code":"##code##","min":"5"}';
}

function devSmsAllowed(code?: string) {
  return !env.isProduction && (!isSmsConfigured() || code === "000000" || code === "dev-pass");
}

async function recordSmsChallenge(phone: string, purpose: SmsPurpose) {
  const subject = phoneHash(phone);
  await getDb()
    .update(schema.smsVerificationChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.smsVerificationChallenges.phoneHash, subject),
        eq(schema.smsVerificationChallenges.purpose, purpose),
        isNull(schema.smsVerificationChallenges.consumedAt),
      ),
    );
  await getDb().insert(schema.smsVerificationChallenges).values({
    phoneHash: subject,
    purpose,
    expiresAt: new Date(Date.now() + env.aliyunSmsValidTimeSeconds * 1000),
    createdAt: new Date(),
  });
}

async function findSmsChallenge(phone: string, purpose: SmsPurpose) {
  const [challenge] = await getDb()
    .select()
    .from(schema.smsVerificationChallenges)
    .where(
      and(
        eq(schema.smsVerificationChallenges.phoneHash, phoneHash(phone)),
        eq(schema.smsVerificationChallenges.purpose, purpose),
        isNull(schema.smsVerificationChallenges.consumedAt),
        gt(schema.smsVerificationChallenges.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(schema.smsVerificationChallenges.createdAt))
    .limit(1);
  if (!challenge) throw new Error(SMS_VERIFY_FAILED_MESSAGE);
  return challenge;
}

async function consumeSmsChallenge(id: number) {
  const result = await getDb()
    .update(schema.smsVerificationChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.smsVerificationChallenges.id, id), isNull(schema.smsVerificationChallenges.consumedAt)));
  const header = Array.isArray(result) ? result[0] : result;
  const affectedRows = header && typeof header === "object" && "affectedRows" in header
    ? Number((header as { affectedRows: unknown }).affectedRows)
    : 0;
  if (affectedRows !== 1) throw new Error(SMS_VERIFY_FAILED_MESSAGE);
}

export async function sendSmsCode(phone: string, purpose: SmsPurpose) {
  const normalizedPhone = normalizePhone(phone);

  if (!env.smsAuthEnabled) {
    throw new Error("短信验证码登录注册暂未开放。");
  }

  if (!isSmsConfigured()) {
    if (!env.isProduction) {
      await recordSmsChallenge(normalizedPhone, purpose);
      return { success: true, message: "开发环境短信验证码：000000" };
    }
    throw new Error(SMS_NOT_CONFIGURED_MESSAGE);
  }

  const { SendSmsVerifyCodeRequest, RuntimeOptions } = resolveAliyunSmsSdk();
  const outId = `${purpose}-${randomUUID()}`;
  try {
    const response = await getSmsClient().sendSmsVerifyCodeWithOptions(
      new SendSmsVerifyCodeRequest({
        phoneNumber: normalizedPhone,
        signName: env.aliyunSmsSignName,
        templateCode: env.aliyunSmsTemplateCode,
        templateParam: templateParam(),
        countryCode: env.aliyunSmsCountryCode,
        schemeName: env.aliyunSmsSchemeName || undefined,
        outId,
        interval: env.aliyunSmsIntervalSeconds,
        validTime: env.aliyunSmsValidTimeSeconds,
        returnVerifyCode: false,
        codeType: 1,
        codeLength: 6,
        duplicatePolicy: 1,
      }),
      new RuntimeOptions({}),
    );

    const body = response.body;
    if (!body?.success || body.code !== "OK") {
      console.error("[sms] send failed", {
        requestId: body?.requestId,
        code: body?.code,
        message: body?.message,
      });
      throw new Error(SMS_SEND_FAILED_MESSAGE);
    }

    await recordSmsChallenge(normalizedPhone, purpose);
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message === SMS_SEND_FAILED_MESSAGE) {
      throw err;
    }
    const apiError = err as { code?: string; message?: string; data?: { RequestId?: string; Code?: string; Message?: string } };
    console.error("[sms] SDK send failed", {
      requestId: apiError.data?.RequestId,
      code: apiError.code || apiError.data?.Code,
      message: apiError.message || apiError.data?.Message,
    });
    throw new Error(SMS_SEND_FAILED_MESSAGE);
  }
}

export async function verifySmsCode(phone: string, code: string, purpose: SmsPurpose = "login") {
  const normalizedPhone = normalizePhone(phone);
  const verifyCode = code.trim();
  const challenge = await findSmsChallenge(normalizedPhone, purpose);

  if (devSmsAllowed(verifyCode)) {
    await consumeSmsChallenge(challenge.id);
    return;
  }

  if (!env.smsAuthEnabled) {
    throw new Error("短信验证码登录注册暂未开放。");
  }
  if (!isSmsConfigured()) {
    throw new Error(SMS_NOT_CONFIGURED_MESSAGE);
  }

  const { CheckSmsVerifyCodeRequest, RuntimeOptions } = resolveAliyunSmsSdk();
  try {
    const response = await getSmsClient().checkSmsVerifyCodeWithOptions(
      new CheckSmsVerifyCodeRequest({
        phoneNumber: normalizedPhone,
        verifyCode,
        countryCode: env.aliyunSmsCountryCode,
        schemeName: env.aliyunSmsSchemeName || undefined,
        caseAuthPolicy: 1,
      }),
      new RuntimeOptions({}),
    );

    const body = response.body;
    if (!body?.success || body.code !== "OK" || body.model?.verifyResult !== "PASS") {
      console.error("[sms] verification rejected", {
        requestId: body?.requestId,
        code: body?.code,
        message: body?.message,
        verifyResult: body?.model?.verifyResult,
      });
      throw new Error(SMS_VERIFY_FAILED_MESSAGE);
    }
    await consumeSmsChallenge(challenge.id);
  } catch (err) {
    if (err instanceof Error && err.message === SMS_VERIFY_FAILED_MESSAGE) {
      throw err;
    }
    const apiError = err as { code?: string; message?: string; data?: { RequestId?: string; Code?: string; Message?: string } };
    console.error("[sms] SDK verify failed", {
      requestId: apiError.data?.RequestId,
      code: apiError.code || apiError.data?.Code,
      message: apiError.message || apiError.data?.Message,
    });
    throw new Error(SMS_VERIFY_FAILED_MESSAGE);
  }
}
