import { z } from "zod";
import bcrypt from "bcryptjs";
import * as cookie from "cookie";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { findUserByEmail, findUserById } from "./queries/users";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { signAccessToken, signRefreshToken } from "./lib/session";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";
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

const LOGIN_LOCK_WINDOW_MS = 30 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function requestIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

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

async function countRecentLoginFailures(email: string, ip: string) {
  const since = new Date(Date.now() - LOGIN_LOCK_WINDOW_MS);
  const rows = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.loginAttempts)
    .where(
      and(
        gte(schema.loginAttempts.attemptedAt, since),
        or(eq(schema.loginAttempts.email, email), eq(schema.loginAttempts.ip, ip)),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

async function recordLoginFailure(email: string, ip: string, userId?: number) {
  await getDb().insert(schema.loginAttempts).values({
    email,
    ip,
    attemptedAt: new Date(),
  });

  const count = await countRecentLoginFailures(email, ip);
  if (userId && count >= MAX_LOGIN_FAILURES) {
    await getDb()
      .update(schema.users)
      .set({ lockedUntil: new Date(Date.now() + LOGIN_LOCK_WINDOW_MS) })
      .where(eq(schema.users.id, userId));
  }
}

async function sendPurposeCode(email: string, purpose: "register" | "reset_password", ip: string) {
  const code = await createVerificationCode(email, purpose, ip);
  await sendVerificationEmail(email, code, {
    subject: verificationSubject(purpose),
    label: verificationTemplateLabel(purpose),
  });
}

export const emailAuthRouter = createRouter({
  captchaConfig: publicQuery.query(() => getCaptchaClientConfig()),

  sendCode: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      await verifyAliyunCaptcha(input.captchaVerifyParam);

      const existing = await findUserByEmail(email);
      if (!existing) {
        await sendPurposeCode(email, "register", requestIp(ctx.req.headers));
      }

      return { success: true, message: "如果该邮箱可以注册，验证码将发送到该邮箱。" };
    }),

  register: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        code: z.string().length(6, "请输入 6 位验证码"),
        name: z.string().min(1, "请输入昵称").max(50, "昵称过长"),
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

      const codeRecord = await verifyEmailCode(email, "register", input.code);
      const existing = await findUserByEmail(email);
      if (existing) {
        throw new Error("该邮箱已经注册，请直接登录。");
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      const userId = await getDb().transaction(async (tx) => {
        const [allowlistRecord] = await tx
          .select()
          .from(schema.adminEmailAllowlist)
          .where(and(eq(schema.adminEmailAllowlist.email, email), isNull(schema.adminEmailAllowlist.usedAt)))
          .orderBy(desc(schema.adminEmailAllowlist.createdAt))
          .limit(1);

        const role = allowlistRecord ? "admin" : "user";
        const level = allowlistRecord ? 99 : 0;
        const publicId = await allocatePublicId(tx, allowlistRecord ? "admin_public_id" : "user_public_id");
        const [{ id }] = await tx
          .insert(schema.users)
          .values({
            publicId,
            name: input.name.trim(),
            email,
            password: hashedPassword,
            role,
            level,
            emailVerified: true,
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

        await tx
          .update(schema.verificationCodes)
          .set({ consumedAt: new Date() })
          .where(eq(schema.verificationCodes.id, codeRecord.id));

        return id;
      });

      const user = await findUserById(userId);
      return { success: true, user: toCurrentUser(user) };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        password: z.string().min(1, "请输入密码"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      const password = input.password;

      const failures = await countRecentLoginFailures(email, ip);
      if (failures >= MAX_LOGIN_FAILURES) {
        throw new Error("登录失败次数过多，请 30 分钟后再试。");
      }

      const user = await findUserByEmail(email);
      if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        throw new Error(remainingLockMessage(user.lockedUntil));
      }

      if (!user?.password) {
        await recordLoginFailure(email, ip);
        throw new Error("邮箱或密码不正确。");
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await recordLoginFailure(email, ip, user.id);
        throw new Error("邮箱或密码不正确。");
      }

      await getDb().delete(schema.loginAttempts).where(or(eq(schema.loginAttempts.email, email), eq(schema.loginAttempts.ip, ip)));
      await getDb()
        .update(schema.users)
        .set({ lastSignInAt: new Date(), lockedUntil: null })
        .where(eq(schema.users.id, user.id));

      const freshUser = await findUserById(user.id);
      if (!freshUser) throw new Error("用户不存在。");
      const accessToken = await signAccessToken(freshUser.id, freshUser.sessionVersion);
      const refreshToken = await signRefreshToken(freshUser.id, freshUser.sessionVersion);
      setAuthCookies(ctx.resHeaders, ctx.req.headers, accessToken, refreshToken);

      return {
        success: true,
        user: toCurrentUser(freshUser),
      };
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
      await verifyAliyunCaptcha(input.captchaVerifyParam);

      const existing = await findUserByEmail(email);
      if (existing?.emailVerified) {
        await sendPurposeCode(email, "reset_password", requestIp(ctx.req.headers));
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
      if (!user?.password) {
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
      await getDb().delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));

      return { success: true };
    }),
});
