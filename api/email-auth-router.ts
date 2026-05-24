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
import { toCurrentUser } from "./lib/user-dto";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function validateDisplayNameLength(name: string): boolean {
  let displayLen = 0;
  for (const char of name) {
    displayLen += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return displayLen <= 20;
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
  sendCode: publicQuery
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address"),
      }),
    )
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase();

      const existing = await findUserByEmail(email);
      if (existing?.password) {
        throw new Error("This email is already registered. Please log in.");
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await getDb().delete(schema.verificationCodes).where(eq(schema.verificationCodes.email, email));

      await getDb().insert(schema.verificationCodes).values({
        email,
        code,
        expiresAt,
      });

      try {
        await sendVerificationEmail(email, code);
      } catch (err) {
        if (!env.isProduction && (!env.smtpHost || !env.smtpUser || !env.smtpPass)) {
          console.warn("Email service is not configured; returning devCode in non-production.");
        } else {
        await getDb().delete(schema.verificationCodes).where(eq(schema.verificationCodes.email, email));
        console.error("Failed to send email:", err);
        throw new Error("Verification email failed to send. Please try again later.");
        }
      }

      const result: { success: true; message: string; devCode?: string } = {
        success: true,
        message: "Verification code sent. Please check your email.",
      };
      if (!env.isProduction) {
        result.devCode = code;
      }
      return result;
    }),

  register: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
        name: z.string().min(1).max(50),
        password: z.string().min(6).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();
      const { code, name, password } = input;

      if (!validateDisplayNameLength(name)) {
        throw new Error("Display name is too long.");
      }

      const existing = await findUserByEmail(email);
      if (existing?.password) {
        throw new Error("This email is already registered.");
      }

      const codeRecord = await getDb()
        .select()
        .from(schema.verificationCodes)
        .where(eq(schema.verificationCodes.email, email))
        .orderBy(sql`${schema.verificationCodes.createdAt} DESC`)
        .limit(1);

      if (!codeRecord.length) {
        throw new Error("Verification code not found. Please request a new one.");
      }

      const record = codeRecord[0];
      if (record.code !== code) {
        throw new Error("Invalid verification code.");
      }

      if (new Date() > record.expiresAt) {
        throw new Error("Verification code expired. Please request a new one.");
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const isAdmin = env.adminEmail && email === env.adminEmail.toLowerCase();
      const user = await createEmailUser({
        name,
        email,
        password: hashedPassword,
        role: isAdmin ? "admin" : "user",
      });

      if (!user) {
        throw new Error("Registration failed.");
      }

      await getDb().delete(schema.verificationCodes).where(eq(schema.verificationCodes.email, email));

      const accessToken = await signAccessToken(user.id);
      const refreshToken = await signRefreshToken(user.id);
      setAuthCookies(ctx.resHeaders, ctx.req.headers, accessToken, refreshToken);

      return {
        success: true,
        user: toCurrentUser(user),
      };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();
      const { password } = input;

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const attempts = await getDb()
        .select({ count: sql<number>`count(*)` })
        .from(schema.loginAttempts)
        .where(and(eq(schema.loginAttempts.email, email), gte(schema.loginAttempts.attemptedAt, oneHourAgo)));
      const attemptCount = Number(attempts[0]?.count ?? 0);
      if (attemptCount >= 5) {
        throw new Error("Too many login attempts. Please try again later.");
      }

      const user = await findUserByEmail(email);
      if (!user?.password) {
        await getDb().insert(schema.loginAttempts).values({
          email,
          ip: ctx.req.headers.get("x-forwarded-for") || "unknown",
        });
        throw new Error("Email or password is incorrect.");
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await getDb().insert(schema.loginAttempts).values({
          email,
          ip: ctx.req.headers.get("x-forwarded-for") || "unknown",
        });
        throw new Error("Email or password is incorrect.");
      }

      await getDb().delete(schema.loginAttempts).where(eq(schema.loginAttempts.email, email));
      await getDb().update(schema.users).set({ lastSignInAt: new Date() }).where(eq(schema.users.id, user.id));

      const accessToken = await signAccessToken(user.id);
      const refreshToken = await signRefreshToken(user.id);
      setAuthCookies(ctx.resHeaders, ctx.req.headers, accessToken, refreshToken);

      return {
        success: true,
        user: toCurrentUser(user),
      };
    }),
});
