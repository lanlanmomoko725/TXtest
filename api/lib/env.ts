import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optional(name: string): string {
  return process.env[name] ?? "";
}

function captchaRegion(): "cn" | "sgp" {
  const region = optional("ALIYUN_CAPTCHA_REGION") || "cn";
  if (region !== "cn" && region !== "sgp") {
    throw new Error("ALIYUN_CAPTCHA_REGION must be either 'cn' or 'sgp'.");
  }
  return region;
}

const emailAuthEnabled = optional("EMAIL_AUTH_ENABLED") !== "false";
const smsAuthEnabled = optional("SMS_AUTH_ENABLED") !== "false";
const isProduction = process.env.NODE_ENV === "production";
const uploadOwnershipMode = optional("UPLOAD_OWNERSHIP_MODE") || "log";
if (uploadOwnershipMode !== "log" && uploadOwnershipMode !== "enforce") {
  throw new Error("UPLOAD_OWNERSHIP_MODE must be either 'log' or 'enforce'.");
}

export const env = {
  appId: optional("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction,
  databaseUrl: required("DATABASE_URL"),
  adminEmail: optional("ADMIN_EMAIL"),
  smtpHost: optional("SMTP_HOST"),
  smtpPort: optional("SMTP_PORT"),
  smtpUser: optional("SMTP_USER"),
  smtpPass: optional("SMTP_PASS"),
  smtpFrom: optional("SMTP_FROM"),
  cookieSameSite: optional("COOKIE_SAMESITE"),
  allowedOrigins: optional("ALLOWED_ORIGINS"),
  emailAuthEnabled,
  smsAuthEnabled,
  aliyunSmsSignName: optional("ALIYUN_SMS_SIGN_NAME"),
  aliyunSmsTemplateCode: optional("ALIYUN_SMS_TEMPLATE_CODE"),
  aliyunSmsTemplateParam: optional("ALIYUN_SMS_TEMPLATE_PARAM"),
  aliyunSmsSchemeName: optional("ALIYUN_SMS_SCHEME_NAME"),
  aliyunSmsEndpoint: optional("ALIYUN_SMS_ENDPOINT"),
  aliyunSmsCountryCode: optional("ALIYUN_SMS_COUNTRY_CODE") || "86",
  aliyunSmsValidTimeSeconds: Number(optional("ALIYUN_SMS_VALID_TIME_SECONDS") || 300),
  aliyunSmsIntervalSeconds: Number(optional("ALIYUN_SMS_INTERVAL_SECONDS") || 60),
  aliyunCaptchaSceneId: optional("ALIYUN_CAPTCHA_SCENE_ID"),
  aliyunCaptchaPrefix: optional("ALIYUN_CAPTCHA_PREFIX"),
  aliyunCaptchaRegion: captchaRegion(),
  aliyunCaptchaEndpoint: optional("ALIYUN_CAPTCHA_ENDPOINT"),
  alibabaCloudAccessKeyId: optional("ALIBABA_CLOUD_ACCESS_KEY_ID"),
  alibabaCloudAccessKeySecret: optional("ALIBABA_CLOUD_ACCESS_KEY_SECRET"),
  databaseSsl: optional("DATABASE_SSL"),
  databaseSslCaPath: optional("DATABASE_SSL_CA_PATH"),
  commentBlocklist: optional("COMMENT_BLOCKLIST"),
  commentBlockPatterns: optional("COMMENT_BLOCK_PATTERNS"),
  uploadOwnershipMode: uploadOwnershipMode as "log" | "enforce",
  accountRecoveryEnabled: optional("ACCOUNT_RECOVERY_ENABLED") === "true",
  publicAppUrl: optional("PUBLIC_APP_URL"),
  smsNoticeWebhookUrl: optional("SMS_NOTICE_WEBHOOK_URL"),
  smsNoticeWebhookSecret: optional("SMS_NOTICE_WEBHOOK_SECRET"),
};
