import * as cookie from "cookie";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { Session } from "@contracts/constants";
import { isSafeAvatarUploadPath } from "@contracts/upload-path";
import { USERNAME_LENGTH_ERROR, USERNAME_MAX_UNITS, assertValidUsername } from "@contracts/username";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { findUserByEmail, findUserByPhone, updateUser } from "./queries/users";
import { toCurrentUser } from "./lib/user-dto";
import { verifyRefreshToken } from "./lib/session";
import { createSessionTokens, revokeRefreshSession } from "./lib/sessions";
import { decryptIdentity, encryptIdentity, normalizeEmail, normalizePhone, phoneHash } from "./lib/identity";
import { consumeRateLimit, rateLimitKey } from "./lib/rate-limit";
import { requestIp } from "./lib/request-info";
import { verifyAliyunCaptcha } from "./lib/captcha";
import { sendSmsCode, verifySmsCode } from "./lib/sms";
import { LOGIN_PASSWORD_MAX_LENGTH } from "@contracts/password";
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
import { assertUsableUploadPaths } from "./lib/upload-ownership";
import {
  assertStepUpGrant,
  consumeStepUpGrant,
  createStepUpGrant,
  normalizeStepUpTarget,
  regenerateRecoveryCodes,
} from "./lib/account-security";
import { createAuditLog } from "./lib/audit";
import { enqueueSecurityNotification } from "./lib/notifications";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

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

function setAuthCookies(resHeaders: Headers, reqHeaders: Headers, accessToken: string, refreshToken: string) {
  const opts = getSessionCookieOptions(reqHeaders);
  resHeaders.append("set-cookie", cookie.serialize(Session.accessCookieName, accessToken, {
    httpOnly: true,
    path: opts.path,
    sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
    secure: opts.secure,
    maxAge: Session.accessMaxAgeMs / 1000,
  }));
  resHeaders.append("set-cookie", cookie.serialize(Session.refreshCookieName, refreshToken, {
    httpOnly: true,
    path: opts.path,
    sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
    secure: opts.secure,
    maxAge: Session.refreshMaxAgeMs / 1000,
  }));
}

async function refreshCurrentSession(ctx: { req: Request; resHeaders: Headers }, userId: number, sessionVersion: number) {
  const tokens = await createSessionTokens({ userId, sessionVersion, headers: ctx.req.headers });
  setAuthCookies(ctx.resHeaders, ctx.req.headers, tokens.accessToken, tokens.refreshToken);
}

function affectedRows(result: unknown): number | undefined {
  const header = Array.isArray(result) ? result[0] : result;
  return header && typeof header === "object" && "affectedRows" in header
    ? Number((header as { affectedRows: unknown }).affectedRows)
    : undefined;
}

async function enqueueNotificationSafely(params: Parameters<typeof enqueueSecurityNotification>[0]) {
  try {
    await enqueueSecurityNotification(params);
  } catch (error) {
    console.error("[security-notification] Failed to enqueue notification", error);
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

async function rateLimitCaptcha(ip: string, subject: string, purpose: string, userId: number) {
  await consumeRateLimit({
    key: rateLimitKey("captcha", purpose, "user", userId),
    limit: 30,
    windowMs: TEN_MINUTES_MS,
    event: "captcha_rate_limited",
    subject,
    userId,
    ip,
  });
  await consumeRateLimit({
    key: rateLimitKey("captcha", purpose, "ip", ip),
    limit: 60,
    windowMs: TEN_MINUTES_MS,
    event: "captcha_rate_limited",
    subject,
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
        name: z.string().min(1).max(USERNAME_MAX_UNITS, USERNAME_LENGTH_ERROR).optional(),
        avatar: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const name = input.name?.trim();

      const shouldChangeName = Boolean(name && name !== user.name);
      if (shouldChangeName && name) {
        assertValidUsername(name);
        await ensureNameAvailableForUser(name, user.id);
      }
      if (input.avatar && !isSafeAvatarUploadPath(input.avatar)) {
        throw new Error("头像路径无效。");
      }
      if (input.avatar && input.avatar !== user.avatar) {
        await assertUsableUploadPaths({
          paths: [input.avatar],
          userId: user.id,
          purpose: "avatar",
          legacyPaths: [user.avatar],
        });
      }

      if (user.level < 99) {
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

  sendStepUpCode: authedQuery
    .input(
      z.object({
        method: z.enum(["email", "phone"]),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const ip = requestIp(ctx.req.headers);
      await rateLimitCaptcha(ip, `user:${user.id}`, `step-up-${input.method}`, user.id);
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      if (input.method === "email") {
        if (!user.email || !user.emailVerified) throw new Error("当前账号没有可用的已验证邮箱。");
        const code = await createVerificationCode(user.email, "bind_email_old", ip);
        await sendVerificationEmail(user.email, code, {
          subject: verificationSubject("bind_email_old"),
          label: verificationTemplateLabel("bind_email_old"),
        });
        return { success: true, message: "验证码已发送到当前邮箱。" };
      }
      const currentPhone = decryptIdentity(user.phoneEncrypted);
      if (!currentPhone || !user.phoneVerified) throw new Error("当前账号没有可用的已验证手机号。");
      await sendSmsCode(currentPhone, "bind_phone_old");
      return { success: true, message: "验证码已发送到当前手机号。" };
    }),

  createStepUpGrant: authedQuery
    .input(
      z.object({
        action: z.enum(["bind_email", "bind_phone", "recovery_codes"]),
        target: z.string().max(320).default(""),
        method: z.enum(["password", "email", "phone"]),
        proof: z.string().min(1).max(LOGIN_PASSWORD_MAX_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const target = normalizeStepUpTarget(input.action, input.target);
      await consumeRateLimit({
        key: rateLimitKey("step-up", "user", user.id),
        limit: 12,
        windowMs: ONE_HOUR_MS,
        event: "step_up_rate_limited",
        userId: user.id,
        ip: requestIp(ctx.req.headers),
      });

      if (input.method === "password") {
        if (!user.password || !(await bcrypt.compare(input.proof, user.password))) {
          throw new Error("当前密码不正确。");
        }
      } else if (input.method === "email") {
        if (!user.email || !user.emailVerified) throw new Error("当前账号没有可用的已验证邮箱。");
        const record = await verifyEmailCode(user.email, "bind_email_old", input.proof);
        await consumeVerificationCode(record.id);
      } else {
        const currentPhone = decryptIdentity(user.phoneEncrypted);
        if (!currentPhone || !user.phoneVerified) throw new Error("当前账号没有可用的已验证手机号。");
        await verifySmsCode(currentPhone, input.proof, "bind_phone_old");
      }

      const grant = await createStepUpGrant({
        userId: user.id,
        action: input.action,
        target,
        method: input.method,
      });
      await createAuditLog({
        userId: user.id,
        action: "create_step_up_grant",
        targetType: "account",
        targetId: user.id,
        details: { action: input.action, method: input.method },
      });
      return { grantToken: grant.token, expiresAt: grant.expiresAt };
    }),

  generateRecoveryCodes: authedQuery
    .input(z.object({ grantToken: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.level >= 99 || ctx.user.role !== "user") {
        throw new Error("管理员账号必须通过线下运维流程恢复。");
      }
      await consumeStepUpGrant({
        token: input.grantToken,
        userId: ctx.user.id,
        action: "recovery_codes",
        target: "",
      });
      const codes = await regenerateRecoveryCodes(ctx.user.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "regenerate_recovery_codes",
        targetType: "account",
        targetId: ctx.user.id,
      });
      return { codes };
    }),

  sendBindEmailCode: authedQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        grantToken: z.string().min(20),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const email = normalizeEmail(input.email);
      const ip = requestIp(ctx.req.headers);
      await assertStepUpGrant({
        token: input.grantToken,
        userId: user.id,
        action: "bind_email",
        target: email,
      });
      await rateLimitCaptcha(ip, email, "bind-email", user.id);
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitEmailBind(ip, email, user.id);

      const existing = await findUserByEmail(email);
      if (existing && existing.id !== user.id) {
        throw new Error("该邮箱已经绑定其他账号。");
      }

      const code = await createVerificationCode(email, "bind_email_new", ip);
      await sendVerificationEmail(email, code, {
        subject: verificationSubject("bind_email_new"),
        label: verificationTemplateLabel("bind_email_new"),
      });
      return { success: true, message: "邮箱验证码已发送。" };
    }),

  bindEmail: authedQuery
    .input(
      z.object({
        email: z.string().email("请输入有效邮箱地址"),
        code: z.string().length(6, "请输入 6 位验证码"),
        grantToken: z.string().min(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const email = normalizeEmail(input.email);
      const existing = await findUserByEmail(email);
      if (existing && existing.id !== user.id) {
        throw new Error("该邮箱已经绑定其他账号。");
      }

      const grant = await assertStepUpGrant({
        token: input.grantToken,
        userId: user.id,
        action: "bind_email",
        target: email,
      });
      const codeRecord = await verifyEmailCode(email, "bind_email_new", input.code);
      const nextSessionVersion = await getDb().transaction(async (tx) => {
        const [lockedUser] = await tx.select({
          sessionVersion: schema.users.sessionVersion,
          deletedAt: schema.users.deletedAt,
        }).from(schema.users).where(eq(schema.users.id, user.id)).for("update");
        if (!lockedUser || lockedUser.deletedAt) throw new Error("账号不存在或已注销。");
        const nextVersion = lockedUser.sessionVersion + 1;
        const [conflict] = await tx.select({ id: schema.users.id }).from(schema.users)
          .where(eq(schema.users.email, email)).limit(1);
        if (conflict && conflict.id !== user.id) throw new Error("该邮箱已经绑定其他账号。");
        const grantResult = await tx
          .update(schema.stepUpGrants)
          .set({ consumedAt: new Date() })
          .where(and(eq(schema.stepUpGrants.id, grant.id), isNull(schema.stepUpGrants.consumedAt)));
        if (affectedRows(grantResult) !== 1) throw new Error("身份验证已被使用，请重新验证。");
        const codeResult = await tx
          .update(schema.verificationCodes)
          .set({ consumedAt: new Date() })
          .where(and(eq(schema.verificationCodes.id, codeRecord.id), isNull(schema.verificationCodes.consumedAt)));
        if (affectedRows(codeResult) !== 1) throw new Error("验证码已使用，请重新获取。");
        await tx
          .update(schema.users)
          .set({ email, emailVerified: true, sessionVersion: nextVersion, updatedAt: new Date() })
          .where(eq(schema.users.id, user.id));
        await tx
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));
        return nextVersion;
      });
      await refreshCurrentSession(ctx, user.id, nextSessionVersion);
      for (const destination of [user.email, email]) {
        if (destination) {
          await enqueueNotificationSafely({
            channel: "email",
            destination,
            template: "contact_changed",
            payload: { contactLabel: "邮箱" },
          });
        }
      }
      await createAuditLog({
        userId: user.id,
        action: "change_email",
        targetType: "account",
        targetId: user.id,
      });
      const updated = await findUserByEmail(email);
      return toCurrentUser(updated);
    }),

  sendBindPhoneCode: authedQuery
    .input(
      z.object({
        phone: z.string().min(1, "请输入手机号"),
        grantToken: z.string().min(20),
        captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const phone = normalizePhone(input.phone);
      const ip = requestIp(ctx.req.headers);
      await assertStepUpGrant({
        token: input.grantToken,
        userId: user.id,
        action: "bind_phone",
        target: phone,
      });
      await rateLimitCaptcha(ip, `phone:${phoneHash(phone)}`, "bind-phone", user.id);
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      await rateLimitPhoneBind(ip, phone, user.id);

      const existing = await findUserByPhone(phone);
      if (existing && existing.id !== user.id) {
        throw new Error("该手机号已经绑定其他账号。");
      }

      await sendSmsCode(phone, "bind_phone_new");
      return { success: true, message: "短信验证码已发送。" };
    }),

  bindPhone: authedQuery
    .input(
      z.object({
        phone: z.string().min(1, "请输入手机号"),
        smsCode: z.string().min(4, "请输入短信验证码").max(8, "验证码过长"),
        grantToken: z.string().min(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;
      const phone = normalizePhone(input.phone);
      const existing = await findUserByPhone(phone);
      if (existing && existing.id !== user.id) {
        throw new Error("该手机号已经绑定其他账号。");
      }

      const grant = await assertStepUpGrant({
        token: input.grantToken,
        userId: user.id,
        action: "bind_phone",
        target: phone,
      });
      await verifySmsCode(phone, input.smsCode, "bind_phone_new");
      const nextSessionVersion = await getDb().transaction(async (tx) => {
        const [lockedUser] = await tx.select({
          sessionVersion: schema.users.sessionVersion,
          deletedAt: schema.users.deletedAt,
        }).from(schema.users).where(eq(schema.users.id, user.id)).for("update");
        if (!lockedUser || lockedUser.deletedAt) throw new Error("账号不存在或已注销。");
        const nextVersion = lockedUser.sessionVersion + 1;
        const [conflict] = await tx.select({ id: schema.users.id }).from(schema.users)
          .where(eq(schema.users.phoneHash, phoneHash(phone))).limit(1);
        if (conflict && conflict.id !== user.id) throw new Error("该手机号已经绑定其他账号。");
        const grantResult = await tx
          .update(schema.stepUpGrants)
          .set({ consumedAt: new Date() })
          .where(and(eq(schema.stepUpGrants.id, grant.id), isNull(schema.stepUpGrants.consumedAt)));
        if (affectedRows(grantResult) !== 1) throw new Error("身份验证已被使用，请重新验证。");
        await tx
          .update(schema.users)
          .set({
            phoneHash: phoneHash(phone),
            phoneEncrypted: encryptIdentity(phone),
            phoneVerified: true,
            sessionVersion: nextVersion,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id));
        await tx
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));
        return nextVersion;
      });
      await refreshCurrentSession(ctx, user.id, nextSessionVersion);
      const oldPhone = decryptIdentity(user.phoneEncrypted);
      for (const destination of [oldPhone, phone]) {
        if (destination) {
          await enqueueNotificationSafely({
            channel: "sms",
            destination,
            template: "contact_changed",
            payload: { contactLabel: "手机号" },
          });
        }
      }
      await createAuditLog({
        userId: user.id,
        action: "change_phone",
        targetType: "account",
        targetId: user.id,
      });
      const updated = await findUserByPhone(phone);
      return toCurrentUser(updated);
    }),
});
