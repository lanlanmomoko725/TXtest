import { z } from "zod";
import bcrypt from "bcryptjs";
import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, like, or } from "drizzle-orm";
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
import { assertPasswordPolicy } from "./lib/password-policy";
import { LOGIN_PASSWORD_MAX_LENGTH, PASSWORD_MAX_LENGTH } from "@contracts/password";
import { getCaptchaClientConfig, verifyAliyunCaptcha } from "./lib/captcha";
import {
  consumeVerificationCode,
  createVerificationCode,
  verifyEmailCode,
} from "./lib/verification-code";
import { allocatePublicId } from "./lib/account-ids";
import {
  RateLimitError,
  consumeRateLimit,
  getRateLimitCounter,
  incrementRateLimitCounter,
  rateLimitKey,
} from "./lib/rate-limit";
import { requestIp } from "./lib/request-info";
import { createSessionTokens } from "./lib/sessions";
import { encryptIdentity, normalizeEmail, normalizePhone, phoneHash } from "./lib/identity";
import { sendSmsCode, verifySmsCode } from "./lib/sms";
import { enqueueVerificationEmail } from "./lib/notifications";
import {
  DUMMY_PASSWORD_HASH,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_IP_ATTEMPT_LIMIT,
  LOGIN_PAIR_FAILURE_LIMIT,
  compareLoginPassword,
  isLoginPasswordAccepted,
  loginAccountSubject,
  loginFailureKeys,
  requiresLoginCaptcha,
  waitForUniformAuthResponse,
} from "./lib/auth-security";
import { requireSingleAffectedRow } from "./lib/db-result";

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

async function queuePurposeCodeSafely(
  email: string,
  purpose: "bind_email" | "reset_password",
  ip: string,
) {
  try {
    const code = await createVerificationCode(email, purpose, ip);
    await enqueueVerificationEmail({ email, code, purpose });
  } catch (error) {
    console.error("[verification-code] Failed to queue generic verification message", error);
  }
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
      const startedAt = Date.now();
      const phone = normalizePhone(input.phone);
      const ip = requestIp(ctx.req.headers);
      const subject = phoneSubject(phone);
      await rateLimitCaptcha(ip, subject, `sms-${input.purpose}`);
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitSmsSend(ip, phone, input.purpose);

      const existing = await findUserByPhone(phone);
      if (input.purpose === "register" && !existing) {
        try {
          await sendSmsCode(phone, "register");
        } catch (error) {
          console.error("[sms] Failed to send generic registration code", error);
        }
      } else if (input.purpose === "login" && existing) {
        try {
          await sendSmsCode(phone, "login");
        } catch (error) {
          console.error("[sms] Failed to send generic login code", error);
        }
      } else {
        await bcrypt.compare(`sms:${phoneHash(phone)}`, DUMMY_PASSWORD_HASH);
      }

      await waitForUniformAuthResponse(startedAt);
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
      const startedAt = Date.now();
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await rateLimitCaptcha(ip, email, "email-bind");
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitEmailCodeSend(ip, email, "bind");

      const existing = await findUserByEmail(email);
      if (!existing) {
        await queuePurposeCodeSafely(email, "bind_email", ip);
      } else {
        await bcrypt.compare(`email:${email}`, DUMMY_PASSWORD_HASH);
      }

      await waitForUniformAuthResponse(startedAt);
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
      const startedAt = Date.now();
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await rateLimitCaptcha(ip, email, "email-bind");
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitEmailCodeSend(ip, email, "bind");
      const existing = await findUserByEmail(email);
      if (!existing) {
        await queuePurposeCodeSafely(email, "bind_email", ip);
      } else {
        await bcrypt.compare(`email:${email}`, DUMMY_PASSWORD_HASH);
      }
      await waitForUniformAuthResponse(startedAt);
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
        password: z.string().min(8).max(PASSWORD_MAX_LENGTH),
        passwordConfirm: z.string().min(8).max(PASSWORD_MAX_LENGTH),
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
      if (email) {
        if (!input.emailCode || input.emailCode.length !== 6) {
          throw new Error("请输入邮箱验证码，或留空邮箱稍后再绑定。");
        }
      }

      await verifySmsCode(phone, input.smsCode, "register");
      const emailCodeRecord = email ? await verifyEmailCode(email, "bind_email", input.emailCode ?? "") : null;
      await ensureNameAvailable(input.name.trim());
      const existingPhone = await findUserByPhone(phone);
      if (existingPhone) throw new Error("该手机号已经注册，请直接登录。");
      if (email) {
        const existingEmail = await findUserByEmail(email);
        if (existingEmail) throw new Error("该邮箱已经绑定其他账号。");
      }
      const hashedPassword = await bcrypt.hash(input.password, 10);

      const userId = await getDb().transaction(async (tx) => {
        const [phoneConflict] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(eq(schema.users.phoneHash, phoneHash(phone)), isNull(schema.users.deletedAt)))
          .limit(1);
        if (phoneConflict) throw new Error("该手机号已经注册，请直接登录。");
        if (email) {
          const [emailConflict] = await tx
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
            .limit(1);
          if (emailConflict) throw new Error("该邮箱已经绑定其他账号。");
        }
        const [nameConflict] = await tx
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(and(eq(schema.users.name, input.name.trim()), isNull(schema.users.deletedAt)))
          .limit(1);
        if (nameConflict) throw new Error("该用户名已被使用，请换一个。");

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
          await consumeVerificationCode(emailCodeRecord.id, tx);
        }

        return id;
      });

      const user = await findUserById(userId);
      return { success: true, user: toCurrentUser(user) };
    }),

  login: publicQuery
    .input(
      z.object({
        identifier: z.string().min(1, "请输入邮箱或用户名").max(320, "账号输入过长。"),
        password: z.string().min(1, "请输入密码").max(LOGIN_PASSWORD_MAX_LENGTH, "密码输入过长。"),
        captchaVerifyParam: z.string().min(1).max(4096).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const identifier = input.identifier.trim();
      let loginKey = identifier.includes("@") ? normalizeEmail(identifier) : identifier;
      if (!identifier.includes("@")) {
        try {
          loginKey = `phone:${phoneHash(identifier)}`;
        } catch {
          // Non-phone identifiers retain their exact username form.
        }
      }
      const ip = requestIp(ctx.req.headers);
      const subjectHash = loginAccountSubject(loginKey);
      const failureKeys = loginFailureKeys(subjectHash, ip);

      await consumeRateLimit({
        key: rateLimitKey("login", "ip", ip),
        limit: LOGIN_IP_ATTEMPT_LIMIT,
        windowMs: LOGIN_FAILURE_WINDOW_MS,
        event: "login_ip_rate_limited",
        subject: subjectHash,
        ip,
      });

      const pairFailures = await getRateLimitCounter(failureKeys.pair);
      if (pairFailures && pairFailures.count >= LOGIN_PAIR_FAILURE_LIMIT) {
        throw new RateLimitError(
          Math.max(1, Math.ceil((pairFailures.resetAt.getTime() - Date.now()) / 1000)),
        );
      }

      const accountFailures = await getRateLimitCounter(failureKeys.account);
      if (requiresLoginCaptcha(accountFailures?.count ?? 0)) {
        if (!input.captchaVerifyParam) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "请完成人机验证后继续登录。",
          });
        }
        await verifyAliyunCaptcha(input.captchaVerifyParam);
      }

      let user: Awaited<ReturnType<typeof findUserByLoginIdentifier>> = null;
      try {
        user = await findUserByLoginIdentifier(identifier);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("用户名不唯一")) throw error;
      }

      const valid = await compareLoginPassword(input.password, user?.password);
      if (!user || !isLoginPasswordAccepted(user.password, valid)) {
        await incrementRateLimitCounter({ key: failureKeys.account, windowMs: LOGIN_FAILURE_WINDOW_MS });
        const pairBucket = await incrementRateLimitCounter({
          key: failureKeys.pair,
          windowMs: LOGIN_FAILURE_WINDOW_MS,
        });
        if (pairBucket.count > LOGIN_PAIR_FAILURE_LIMIT) {
          throw new RateLimitError(
            Math.max(1, Math.ceil((pairBucket.resetAt.getTime() - Date.now()) / 1000)),
          );
        }
        throw new Error("账号或密码不正确。");
      }

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw new Error(remainingLockMessage(user.lockedUntil));
      }

      const pairPrefix = rateLimitKey("login-failure", "pair", subjectHash, "ip");
      await getDb()
        .delete(schema.rateLimitBuckets)
        .where(or(
          eq(schema.rateLimitBuckets.key, failureKeys.account),
          like(schema.rateLimitBuckets.key, `${pairPrefix}:%`),
        ));
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
        windowMs: LOGIN_FAILURE_WINDOW_MS,
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

      await verifySmsCode(phone, input.smsCode, "login");
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
      const startedAt = Date.now();
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await rateLimitCaptcha(ip, email, "reset");
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitEmailCodeSend(ip, email, "reset");

      const existing = await findUserByEmail(email);
      if (existing?.emailVerified) {
        await queuePurposeCodeSafely(email, "reset_password", ip);
      } else {
        await bcrypt.compare(`reset:${email}`, DUMMY_PASSWORD_HASH);
      }

      await waitForUniformAuthResponse(startedAt);
      return { success: true, message: "如果该邮箱存在，验证码将发送到该邮箱。" };
    }),

  resetPassword: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        code: z.string().length(6, "请输入 6 位验证码"),
        password: z.string().min(8).max(PASSWORD_MAX_LENGTH),
        passwordConfirm: z.string().min(8).max(PASSWORD_MAX_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      if (input.password !== input.passwordConfirm) {
        throw new Error("两次输入的密码不一致。");
      }
      assertPasswordPolicy(input.password);

      const codeRecord = await verifyEmailCode(email, "reset_password", input.code);
      const user = await findUserByEmail(email);
      if (!user?.password || !user.emailVerified) throw new Error("验证码无效或已过期。");
      const hashedPassword = await bcrypt.hash(input.password, 10);
      const ip = requestIp(ctx.req.headers);
      const subjectHash = loginAccountSubject(email);
      const failureKeys = loginFailureKeys(subjectHash, ip);
      const pairPrefix = rateLimitKey("login-failure", "pair", subjectHash, "ip");
      await getDb().transaction(async (tx) => {
        const [lockedUser] = await tx
          .select({
            id: schema.users.id,
            sessionVersion: schema.users.sessionVersion,
            emailVerified: schema.users.emailVerified,
            deletedAt: schema.users.deletedAt,
          })
          .from(schema.users)
          .where(eq(schema.users.id, user.id))
          .for("update");
        if (!lockedUser || lockedUser.deletedAt || !lockedUser.emailVerified) {
          throw new Error("验证码无效或已过期。");
        }

        await consumeVerificationCode(codeRecord.id, tx);
        const updateResult = await tx
          .update(schema.users)
          .set({
            password: hashedPassword,
            sessionVersion: lockedUser.sessionVersion + 1,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(and(eq(schema.users.id, lockedUser.id), isNull(schema.users.deletedAt)));
        requireSingleAffectedRow(updateResult, "账号不存在或已注销。");
        await tx
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(schema.sessions.userId, lockedUser.id), isNull(schema.sessions.revokedAt)));
        await tx.delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));
        await tx
          .delete(schema.rateLimitBuckets)
          .where(or(
            eq(schema.rateLimitBuckets.key, failureKeys.account),
            like(schema.rateLimitBuckets.key, `${pairPrefix}:%`),
          ));
      });

      return { success: true };
    }),
});
