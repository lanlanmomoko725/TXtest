import { z } from "zod";
import bcrypt from "bcryptjs";
import * as cookie from "cookie";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import {
  findUserByEmail,
  findUserById,
  findUserByLoginIdentifier,
  findUserByPhone,
  findUsersByName,
} from "./queries/users";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";
import { USERNAME_LENGTH_ERROR, USERNAME_MAX_UNITS, assertValidUsername } from "@contracts/username";
import { toCurrentUser } from "./lib/user-dto";
import { sendVerificationEmail } from "./lib/mail";
import { assertPasswordPolicy } from "./lib/password-policy";
import { getCaptchaClientConfig, verifyAliyunCaptcha } from "./lib/captcha";
import {
  consumeVerificationCode,
  createVerificationCode,
  verificationSubject,
  verificationTemplateLabel,
  verifyEmailCode,
} from "./lib/verification-code";
import { allocatePublicId } from "./lib/account-ids";
import { consumeRateLimit, rateLimitKey } from "./lib/rate-limit";
import { requestIp } from "./lib/request-info";
import { createSessionTokens, revokeAllUserSessions } from "./lib/sessions";
import { encryptIdentity, normalizeEmail, normalizePhone, phoneHash } from "./lib/identity";
import { sendSmsCode, verifySmsCode } from "./lib/sms";

const LOGIN_LOCK_WINDOW_MS = 30 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type SmsPurpose = "register" | "login";

function setAuthCookies(resHeaders: Headers, reqHeaders: Headers, accessToken: string, refreshToken: string) {
  const opts = getSessionCookieOptions(reqHeaders);
  resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.accessCookieName, accessToken, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.accessMaxAgeMs / 1000,
    }),
  );
  resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.refreshCookieName, refreshToken, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.refreshMaxAgeMs / 1000,
    }),
  );
}

function remainingLockMessage(lockedUntil: Date) {
  const remainingMs = Math.max(0, lockedUntil.getTime() - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `登录失败次数过多，账号已锁定，请 ${minutes} 分钟后再试。`;
}

function phoneSubject(phone: string) {
  return `phone:${phoneHash(phone)}`;
}

async function countRecentLoginFailures(identifier: string) {
  const since = new Date(Date.now() - LOGIN_LOCK_WINDOW_MS);
  const rows = await getDb()
    .select({ count: schema.loginAttempts.id })
    .from(schema.loginAttempts)
    .where(and(gte(schema.loginAttempts.attemptedAt, since), eq(schema.loginAttempts.email, identifier)));
  return rows.length;
}

async function recordLoginFailure(identifier: string, ip: string, userId?: number) {
  await getDb().insert(schema.loginAttempts).values({
    email: identifier,
    ip,
    attemptedAt: new Date(),
  });

  const count = await countRecentLoginFailures(identifier);
  if (userId && count >= MAX_LOGIN_FAILURES) {
    await getDb()
      .update(schema.users)
      .set({ lockedUntil: new Date(Date.now() + LOGIN_LOCK_WINDOW_MS) })
      .where(eq(schema.users.id, userId));
  }
}

async function clearLoginFailures(identifier: string) {
  await getDb().delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, identifier));
}

async function finishLogin(ctx: { req: Request; resHeaders: Headers }, userId: number) {
  await getDb()
    .update(schema.users)
    .set({ lastSignInAt: new Date(), lockedUntil: null })
    .where(eq(schema.users.id, userId));

  const freshUser = await findUserById(userId);
  if (!freshUser) throw new Error("用户不存在。");
  const tokens = await createSessionTokens({
    userId: freshUser.id,
    sessionVersion: freshUser.sessionVersion,
    headers: ctx.req.headers,
  });
  setAuthCookies(ctx.resHeaders, ctx.req.headers, tokens.accessToken, tokens.refreshToken);
  return { success: true, user: toCurrentUser(freshUser) };
}

async function sendPurposeCode(email: string, purpose: "bind_email" | "reset_password", ip: string) {
  const code = await createVerificationCode(email, purpose, ip);
  await sendVerificationEmail(email, code, {
    subject: verificationSubject(purpose),
    label: verificationTemplateLabel(purpose),
  });
}

async function rateLimitCaptcha(ip: string, subject: string, purpose: string) {
  await consumeRateLimit({
    key: rateLimitKey("captcha", purpose, "ip", ip),
    limit: 30,
    windowMs: 10 * ONE_MINUTE_MS,
    event: "captcha_rate_limited",
    subject,
    ip,
  });
}

async function rateLimitEmailCodeSend(ip: string, email: string, purpose: "bind" | "reset") {
  await consumeRateLimit({
    key: rateLimitKey("send-code", purpose, "email", email),
    limit: 3,
    windowMs: ONE_HOUR_MS,
    event: "verification_email_rate_limited",
    subject: email,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("send-code", purpose, "ip", ip),
    limit: 12,
    windowMs: ONE_HOUR_MS,
    event: "verification_ip_rate_limited",
    subject: email,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("send-code", purpose, "day", "email", email),
    limit: 8,
    windowMs: ONE_DAY_MS,
    event: "verification_email_daily_rate_limited",
    subject: email,
    ip,
  });
}

async function rateLimitSmsSend(ip: string, phone: string, purpose: SmsPurpose) {
  const subject = phoneSubject(phone);
  await consumeRateLimit({
    key: rateLimitKey("sms", purpose, "phone", subject),
    limit: 3,
    windowMs: ONE_HOUR_MS,
    event: "sms_phone_rate_limited",
    subject,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("sms", purpose, "ip", ip),
    limit: 12,
    windowMs: ONE_HOUR_MS,
    event: "sms_ip_rate_limited",
    subject,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("sms", purpose, "day", subject),
    limit: 8,
    windowMs: ONE_DAY_MS,
    event: "sms_daily_rate_limited",
    subject,
    ip,
  });
}

async function ensureNameAvailable(name: string, currentUserId?: number) {
  const users = await findUsersByName(name);
  const duplicate = users.find((user) => user.id !== currentUserId);
  if (duplicate) {
    throw new Error("该用户名已被使用，请换一个。");
  }
}

export const emailAuthRouter = createRouter({
  captchaConfig: publicQuery.query(() => getCaptchaClientConfig()),

  sendSmsCode: publicQuery
    .input(
      z.object({
        phone: z.string().min(1, "请输入手机号"),
        purpose: z.enum(["register", "login"]),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhone(input.phone);
      const ip = requestIp(ctx.req.headers);
      const subject = phoneSubject(phone);
      await rateLimitCaptcha(ip, subject, `sms-${input.purpose}`);
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitSmsSend(ip, phone, input.purpose);

      const existing = await findUserByPhone(phone);
      if (input.purpose === "register" && !existing) {
        await sendSmsCode(phone, "register");
      }
      if (input.purpose === "login" && existing) {
        await sendSmsCode(phone, "login");
      }

      return { success: true, message: "如果该手机号可用，验证码将发送到该手机号。" };
    }),

  sendEmailCode: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await rateLimitCaptcha(ip, email, "email-bind");
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitEmailCodeSend(ip, email, "bind");

      const existing = await findUserByEmail(email);
      if (!existing) {
        await sendPurposeCode(email, "bind_email", ip);
      }

      return { success: true, message: "如果该邮箱可以绑定，验证码将发送到该邮箱。" };
    }),

  // Backward-compatible alias for older clients.
  sendCode: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await rateLimitCaptcha(ip, email, "email-bind");
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitEmailCodeSend(ip, email, "bind");
      const existing = await findUserByEmail(email);
      if (!existing) {
        await sendPurposeCode(email, "bind_email", ip);
      }
      return { success: true, message: "如果该邮箱可以绑定，验证码将发送到该邮箱。" };
    }),

  register: publicQuery
    .input(
      z.object({
        phone: z.string().min(1, "请输入手机号"),
        smsCode: z.string().min(4, "请输入短信验证码").max(8, "验证码过长"),
        email: z.string().email("请输入有效邮箱地址").optional().or(z.literal("")),
        emailCode: z.string().optional(),
        name: z.string().min(1, "请输入用户名").max(USERNAME_MAX_UNITS, USERNAME_LENGTH_ERROR),
        password: z.string().min(8),
        passwordConfirm: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhone(input.phone);
      const email = input.email ? normalizeEmail(input.email) : "";
      const ip = requestIp(ctx.req.headers);
      await consumeRateLimit({
        key: rateLimitKey("register", "ip", ip),
        limit: 20,
        windowMs: ONE_HOUR_MS,
        event: "register_ip_rate_limited",
        subject: phoneSubject(phone),
        ip,
      });

      if (input.password !== input.passwordConfirm) {
        throw new Error("两次输入的密码不一致。");
      }
      assertPasswordPolicy(input.password);
      assertValidUsername(input.name);
      await ensureNameAvailable(input.name.trim());

      const existingPhone = await findUserByPhone(phone);
      if (existingPhone) {
        throw new Error("该手机号已经注册，请直接登录。");
      }
      if (email) {
        const existingEmail = await findUserByEmail(email);
        if (existingEmail) {
          throw new Error("该邮箱已经绑定其他账号。");
        }
        if (!input.emailCode || input.emailCode.length !== 6) {
          throw new Error("请输入邮箱验证码，或留空邮箱稍后再绑定。");
        }
      }

      await verifySmsCode(phone, input.smsCode);
      const emailCodeRecord = email ? await verifyEmailCode(email, "bind_email", input.emailCode ?? "") : null;
      const hashedPassword = await bcrypt.hash(input.password, 10);

      const userId = await getDb().transaction(async (tx) => {
        const [allowlistRecord] = email
          ? await tx
              .select()
              .from(schema.adminEmailAllowlist)
              .where(and(eq(schema.adminEmailAllowlist.email, email), isNull(schema.adminEmailAllowlist.usedAt)))
              .orderBy(desc(schema.adminEmailAllowlist.createdAt))
              .limit(1)
          : [];

        const role = allowlistRecord ? "admin" : "user";
        const level = allowlistRecord ? 99 : 0;
        const publicId = await allocatePublicId(tx, allowlistRecord ? "admin_public_id" : "user_public_id");
        const [{ id }] = await tx
          .insert(schema.users)
          .values({
            publicId,
            name: input.name.trim(),
            email: email || null,
            phoneHash: phoneHash(phone),
            phoneEncrypted: encryptIdentity(phone),
            password: hashedPassword,
            role,
            level,
            emailVerified: Boolean(email),
            phoneVerified: true,
            sessionVersion: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignInAt: new Date(),
          })
          .$returningId();

        if (allowlistRecord) {
          await tx
            .update(schema.adminEmailAllowlist)
            .set({ usedBy: id, usedAt: new Date() })
            .where(eq(schema.adminEmailAllowlist.id, allowlistRecord.id));
        }

        if (emailCodeRecord) {
          await tx
            .update(schema.verificationCodes)
            .set({ consumedAt: new Date() })
            .where(eq(schema.verificationCodes.id, emailCodeRecord.id));
        }

        return id;
      });

      const user = await findUserById(userId);
      return { success: true, user: toCurrentUser(user) };
    }),

  login: publicQuery
    .input(
      z.object({
        identifier: z.string().min(1, "请输入邮箱或用户名"),
        password: z.string().min(1, "请输入密码"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const identifier = input.identifier.trim();
      const loginKey = identifier.includes("@") ? normalizeEmail(identifier) : identifier;
      const ip = requestIp(ctx.req.headers);

      await consumeRateLimit({
        key: rateLimitKey("login", "ip", ip),
        limit: 40,
        windowMs: LOGIN_LOCK_WINDOW_MS,
        event: "login_ip_rate_limited",
        subject: loginKey,
        ip,
      });

      const failures = await countRecentLoginFailures(loginKey);
      if (failures >= MAX_LOGIN_FAILURES) {
        throw new Error("登录失败次数过多，请 30 分钟后再试。");
      }

      const user = await findUserByLoginIdentifier(identifier);
      if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw new Error(remainingLockMessage(user.lockedUntil));
      }

      if (!user?.password) {
        await recordLoginFailure(loginKey, ip);
        throw new Error("账号或密码不正确。");
      }

      const valid = await bcrypt.compare(input.password, user.password);
      if (!valid) {
        await recordLoginFailure(loginKey, ip, user.id);
        throw new Error("账号或密码不正确。");
      }

      await clearLoginFailures(loginKey);
      if (user.email) await clearLoginFailures(normalizeEmail(user.email));
      if (user.phoneHash) await clearLoginFailures(`phone:${user.phoneHash}`);
      return finishLogin(ctx, user.id);
    }),

  loginWithSms: publicQuery
    .input(
      z.object({
        phone: z.string().min(1, "请输入手机号"),
        smsCode: z.string().min(4, "请输入短信验证码").max(8, "验证码过长"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhone(input.phone);
      const ip = requestIp(ctx.req.headers);
      const loginKey = phoneSubject(phone);

      await consumeRateLimit({
        key: rateLimitKey("login-sms", "ip", ip),
        limit: 40,
        windowMs: LOGIN_LOCK_WINDOW_MS,
        event: "login_sms_ip_rate_limited",
        subject: loginKey,
        ip,
      });

      const user = await findUserByPhone(phone);
      if (!user) {
        throw new Error("手机号或验证码不正确。");
      }
      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw new Error(remainingLockMessage(user.lockedUntil));
      }

      await verifySmsCode(phone, input.smsCode);
      await clearLoginFailures(loginKey);
      return finishLogin(ctx, user.id);
    }),

  sendResetCode: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await rateLimitCaptcha(ip, email, "reset");
      await verifyAliyunCaptcha(input.captchaVerifyParam);

      const existing = await findUserByEmail(email);
      if (existing?.emailVerified) {
        await rateLimitEmailCodeSend(ip, email, "reset");
        await sendPurposeCode(email, "reset_password", ip);
      }

      return { success: true, message: "如果该邮箱存在，验证码将发送到该邮箱。" };
    }),

  resetPassword: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        code: z.string().length(6, "请输入 6 位验证码"),
        password: z.string().min(8),
        passwordConfirm: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      const email = normalizeEmail(input.email);
      if (input.password !== input.passwordConfirm) {
        throw new Error("两次输入的密码不一致。");
      }
      assertPasswordPolicy(input.password);

      const user = await findUserByEmail(email);
      if (!user?.password || !user.emailVerified) {
        throw new Error("验证码无效或已过期。");
      }

      const codeRecord = await verifyEmailCode(email, "reset_password", input.code);
      const hashedPassword = await bcrypt.hash(input.password, 10);
      await getDb()
        .update(schema.users)
        .set({
          password: hashedPassword,
          sessionVersion: user.sessionVersion + 1,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));
      await consumeVerificationCode(codeRecord.id);
      await clearLoginFailures(email);
      await revokeAllUserSessions(user.id);

      return { success: true };
    }),
});
