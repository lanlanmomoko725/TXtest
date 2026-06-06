import * as cookie from "cookie";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { Session } from "@contracts/constants";
import { isSafeAvatarUploadPath } from "@contracts/upload-path";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { findUserByEmail, findUserByPhone, updateUser } from "./queries/users";
import { toCurrentUser } from "./lib/user-dto";
import { verifyRefreshToken } from "./lib/session";
import { revokeRefreshSession } from "./lib/sessions";
import { normalizeEmail, normalizePhone, phoneHash } from "./lib/identity";
import { consumeRateLimit, rateLimitKey } from "./lib/rate-limit";
import { requestIp } from "./lib/request-info";
import { verifyAliyunCaptcha } from "./lib/captcha";
import { sendSmsCode, verifySmsCode } from "./lib/sms";
import {
  consumeVerificationCode,
  createVerificationCode,
  verificationSubject,
  verificationTemplateLabel,
  verifyEmailCode,
} from "./lib/verification-code";
import { sendVerificationEmail } from "./lib/mail";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import {
  createProfileChangeRequests,
  ensureNameAvailableForUser,
  getProfileChangeStatus,
} from "./lib/profile-changes";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function validateNameLength(name: string): boolean {
  let length = 0;
  for (const char of name) {
    length += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return length <= 20;
}

function clearAuthCookies(resHeaders: Headers, reqHeaders: Headers) {
  const opts = getSessionCookieOptions(reqHeaders);
  for (const name of [Session.accessCookieName, Session.refreshCookieName]) {
    resHeaders.append(
      "set-cookie",
      cookie.serialize(name, "", {
        httpOnly: true,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
  }
}

async function rateLimitEmailBind(ip: string, email: string, userId: number) {
  await consumeRateLimit({
    key: rateLimitKey("bind-email", "user", userId),
    limit: 5,
    windowMs: ONE_HOUR_MS,
    event: "bind_email_user_rate_limited",
    subject: email,
    userId,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("bind-email", "email", email),
    limit: 3,
    windowMs: ONE_HOUR_MS,
    event: "bind_email_target_rate_limited",
    subject: email,
    userId,
    ip,
  });
}

async function rateLimitPhoneBind(ip: string, phone: string, userId: number) {
  const subject = `phone:${phoneHash(phone)}`;
  await consumeRateLimit({
    key: rateLimitKey("bind-phone", "user", userId),
    limit: 5,
    windowMs: ONE_HOUR_MS,
    event: "bind_phone_user_rate_limited",
    subject,
    userId,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("bind-phone", "phone", subject),
    limit: 3,
    windowMs: ONE_HOUR_MS,
    event: "bind_phone_target_rate_limited",
    subject,
    userId,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("bind-phone", "day", subject),
    limit: 8,
    windowMs: ONE_DAY_MS,
    event: "bind_phone_daily_rate_limited",
    subject,
    userId,
    ip,
  });
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => toCurrentUser(opts.ctx.user)),

  profileChangeStatus: authedQuery.query(({ ctx }) => getProfileChangeStatus(ctx.user.id)),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const cookies = cookie.parse(ctx.req.headers.get("cookie") || "");
    const refreshToken = cookies[Session.refreshCookieName];
    const claim = refreshToken ? await verifyRefreshToken(refreshToken) : null;
    await revokeRefreshSession(claim?.jti);
    clearAuthCookies(ctx.resHeaders, ctx.req.headers);
    return { success: true };
  }),

  updateProfile: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(20).optional(),
        avatar: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const name = input.name?.trim();

      if (name) {
        if (!validateNameLength(name)) {
          throw new Error("用户名过长：最多 10 个汉字或 20 个英文字符。");
        }
        await ensureNameAvailableForUser(name, user.id);
      }
      if (input.avatar && !isSafeAvatarUploadPath(input.avatar)) {
        throw new Error("头像路径无效。");
      }

      if (user.level < 99) {
        const shouldChangeName = Boolean(name && name !== user.name);
        const shouldChangeAvatar = Boolean(input.avatar && input.avatar !== user.avatar);
        if (!shouldChangeName && !shouldChangeAvatar) {
          throw new Error("没有需要提交审核的资料变更。");
        }
        await createProfileChangeRequests(user, [
          ...(shouldChangeName && name ? [{ type: "name" as const, value: name }] : []),
          ...(shouldChangeAvatar && input.avatar ? [{ type: "avatar" as const, value: input.avatar }] : []),
        ]);
        return {
          user: toCurrentUser(user),
          reviewRequired: true,
          profileChangeStatus: await getProfileChangeStatus(user.id),
        };
      }

      const updated = await updateUser(user.id, {
        name,
        avatar: input.avatar,
      });
      return {
        user: toCurrentUser(updated),
        reviewRequired: false,
        profileChangeStatus: await getProfileChangeStatus(user.id),
      };
    }),

  sendBindEmailCode: authedQuery
    .input(z.object({ email: z.string().email("请输入有效邮箱地址") }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await rateLimitEmailBind(ip, email, user.id);

      const existing = await findUserByEmail(email);
      if (existing && existing.id !== user.id) {
        throw new Error("该邮箱已经绑定其他账号。");
      }

      const code = await createVerificationCode(email, "bind_email", ip);
      await sendVerificationEmail(email, code, {
        subject: verificationSubject("bind_email"),
        label: verificationTemplateLabel("bind_email"),
      });
      return { success: true, message: "邮箱验证码已发送。" };
    }),

  bindEmail: authedQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        code: z.string().length(6, "请输入 6 位验证码"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const email = normalizeEmail(input.email);
      const existing = await findUserByEmail(email);
      if (existing && existing.id !== user.id) {
        throw new Error("该邮箱已经绑定其他账号。");
      }

      const codeRecord = await verifyEmailCode(email, "bind_email", input.code);
      await updateUser(user.id, { email, emailVerified: true });
      await consumeVerificationCode(codeRecord.id);
      await getDb()
        .update(schema.adminEmailAllowlist)
        .set({ usedBy: user.id, usedAt: new Date() })
        .where(eq(schema.adminEmailAllowlist.email, email));
      const updated = await updateUser(user.id, {});
      return toCurrentUser(updated);
    }),

  sendBindPhoneCode: authedQuery
    .input(
      z.object({
        phone: z.string().min(1, "请输入手机号"),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const phone = normalizePhone(input.phone);
      const ip = requestIp(ctx.req.headers);
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitPhoneBind(ip, phone, user.id);

      const existing = await findUserByPhone(phone);
      if (existing && existing.id !== user.id) {
        throw new Error("该手机号已经绑定其他账号。");
      }

      await sendSmsCode(phone, "bind_phone");
      return { success: true, message: "短信验证码已发送。" };
    }),

  bindPhone: authedQuery
    .input(
      z.object({
        phone: z.string().min(1, "请输入手机号"),
        smsCode: z.string().min(4, "请输入短信验证码").max(8, "验证码过长"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const phone = normalizePhone(input.phone);
      const existing = await findUserByPhone(phone);
      if (existing && existing.id !== user.id) {
        throw new Error("该手机号已经绑定其他账号。");
      }

      await verifySmsCode(phone, input.smsCode);
      const updated = await updateUser(user.id, { phone, phoneVerified: true });
      return toCurrentUser(updated);
    }),
});
