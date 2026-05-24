import { z } from "zod";
import bcrypt from "bcryptjs";
import * as cookie from "cookie";
import { createRouter, publicQuery } from "./middleware";
import { findUserByEmail } from "./queries/users";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { signAccessToken, signRefreshToken } from "./lib/session";
import { getSessionCookieOptions } from "./lib/cookies";
import { Session } from "@contracts/constants";
import { toCurrentUser } from "./lib/user-dto";

const REGISTRATION_DISABLED_MESSAGE = "公开注册暂未开放，请联系管理员创建账号。";

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
    .mutation(() => {
      throw new Error(REGISTRATION_DISABLED_MESSAGE);
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
    .mutation(() => {
      throw new Error(REGISTRATION_DISABLED_MESSAGE);
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
