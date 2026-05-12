import { z } from "zod";
import bcrypt from "bcryptjs";
import * as cookie from "cookie";
import { createRouter, publicQuery } from "./middleware";
import { findUserByEmail, createEmailUser } from "./queries/users";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { sendVerificationEmail } from "./lib/mail";
import { signAccessToken, signRefreshToken } from "./lib/session";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

export const emailAuthRouter = createRouter({
  // Send verification code
  sendCode: publicQuery
    .input(
      z.object({
        email: z.string().email("请输入有效的邮箱地址"),
      })
    )
    .mutation(async ({ input }) => {
      const { email } = input;

      const existing = await findUserByEmail(email);
      if (existing && existing.password) {
        throw new Error("该邮箱已注册，请直接登录");
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await getDb()
        .delete(schema.verificationCodes)
        .where(eq(schema.verificationCodes.email, email));

      await getDb().insert(schema.verificationCodes).values({
        email,
        code,
        expiresAt,
      });

      try {
        await sendVerificationEmail(email, code);
      } catch (err) {
        console.error("Failed to send email:", err);
      }

      return {
        success: true,
        message: "验证码已发送，请查收邮件（如未收到，可使用下方验证码）",
        devCode: code,
      };
    }),

  // Verify code and register
  register: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
        name: z.string().min(1).max(50),
        password: z.string().min(6).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let displayLen = 0;
      for (const char of input.name) {
        displayLen += char.charCodeAt(0) > 127 ? 2 : 1;
      }
      if (displayLen > 20) {
        throw new Error("昵称过长：最多10个汉字或20个英文字母");
      }
      const { email, code, name, password } = input;

      const existing = await findUserByEmail(email);
      if (existing && existing.password) {
        throw new Error("该邮箱已注册");
      }

      const codeRecord = await getDb()
        .select()
        .from(schema.verificationCodes)
        .where(eq(schema.verificationCodes.email, email))
        .orderBy(sql`${schema.verificationCodes.createdAt} DESC`)
        .limit(1);

      if (!codeRecord.length) {
        throw new Error("验证码不存在，请重新获取");
      }

      const record = codeRecord[0];
      if (record.code !== code) {
        throw new Error("验证码错误");
      }

      if (new Date() > record.expiresAt) {
        throw new Error("验证码已过期，请重新获取");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Auto-assign admin if email matches ADMIN_EMAIL
      const isAdmin = env.adminEmail && email.toLowerCase() === env.adminEmail.toLowerCase();

      const user = await createEmailUser({
        name,
        email,
        password: hashedPassword,
        role: isAdmin ? "admin" : "user",
      });

      if (!user) {
        throw new Error("注册失败");
      }

      await getDb()
        .delete(schema.verificationCodes)
        .where(eq(schema.verificationCodes.email, email));

      const accessToken = await signAccessToken(user.id);
      const refreshToken = await signRefreshToken(user.id);
      setAuthCookies(ctx.resHeaders, ctx.req.headers, accessToken, refreshToken);

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      };
    }),

  // Email login
  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { email, password } = input;

      // Rate limit check
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const attempts = await getDb()
        .select({ count: sql<number>`count(*)` })
        .from(schema.loginAttempts)
        .where(
          and(
            eq(schema.loginAttempts.email, email),
            gte(schema.loginAttempts.attemptedAt, oneHourAgo),
          )
        );
      const attemptCount = Number(attempts[0]?.count ?? 0);
      if (attemptCount >= 5) {
        throw new Error("登录尝试次数过多，请1小时后再试");
      }

      const user = await findUserByEmail(email);
      if (!user || !user.password) {
        // Record failed attempt
        await getDb().insert(schema.loginAttempts).values({
          email,
          ip: ctx.req.headers.get("x-forwarded-for") || "unknown",
        });
        throw new Error("邮箱或密码错误");
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await getDb().insert(schema.loginAttempts).values({
          email,
          ip: ctx.req.headers.get("x-forwarded-for") || "unknown",
        });
        throw new Error("邮箱或密码错误");
      }

      // Clear failed attempts on success
      await getDb()
        .delete(schema.loginAttempts)
        .where(eq(schema.loginAttempts.email, email));

      // Update last sign in
      await getDb()
        .update(schema.users)
        .set({ lastSignInAt: new Date() })
        .where(eq(schema.users.id, user.id));

      const accessToken = await signAccessToken(user.id);
      const refreshToken = await signRefreshToken(user.id);
      setAuthCookies(ctx.resHeaders, ctx.req.headers, accessToken, refreshToken);

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      };
    }),
});
