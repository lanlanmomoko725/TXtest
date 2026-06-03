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
const isProduction = process.env.NODE_ENV === "production";

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
};
