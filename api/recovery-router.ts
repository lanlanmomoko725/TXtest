import { z } from "zod";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { verifyAliyunCaptcha } from "./lib/captcha";
import { env } from "./lib/env";
import { createVerificationCode, consumeVerificationCode, verifyEmailCode, verificationSubject, verificationTemplateLabel } from "./lib/verification-code";
import { sendVerificationEmail } from "./lib/mail";
import { sendSmsCode, verifySmsCode } from "./lib/sms";
import { consumeRateLimit, rateLimitKey } from "./lib/rate-limit";
import { requestIp } from "./lib/request-info";
import { privateValueHash } from "./lib/identity";
import {
  assertRecoveryContactAvailable,
  cancelOwnRecovery,
  cancelRecoveryByToken,
  completeManualRecovery,
  createManualRecoveryRequest,
  findRecoverableUser,
  listOwnRecoveryRequests,
  normalizeRecoveryContact,
  recoverWithRecoveryCode,
} from "./lib/account-recovery";
import { recordSecurityEvent } from "./lib/security-events";
import { PASSWORD_MAX_LENGTH } from "@contracts/password";

const ONE_HOUR_MS = 60 * 60 * 1000;
const GENERIC_SEND_MESSAGE = "如果账号和联系方式符合恢复条件，验证码将发送到新的联系方式。";

function assertRecoveryEnabled() {
  if (!env.accountRecoveryEnabled) throw new Error("账号恢复功能暂未开放，请联系管理员。");
}

function appUrl(request: Request) {
  return env.publicAppUrl || new URL(request.url).origin;
}

async function verifyRecoveryContactCode(type: "email" | "phone", contact: string, code: string) {
  if (type === "email") {
    const record = await verifyEmailCode(contact, "recovery_new_email", code);
    await consumeVerificationCode(record.id);
  } else {
    await verifySmsCode(contact, code, "recovery_new_phone");
  }
}

export const recoveryRouter = createRouter({
  enabled: publicQuery.query(() => ({ enabled: env.accountRecoveryEnabled })),

  sendCode: publicQuery
    .input(z.object({
      identifier: z.string().trim().min(1).max(320),
      contactType: z.enum(["email", "phone"]),
      newContact: z.string().trim().min(1).max(320),
      captchaVerifyParam: z.string().min(1, "请先完成人机验证"),
    }))
    .mutation(async ({ ctx, input }) => {
      assertRecoveryEnabled();
      const ip = requestIp(ctx.req.headers);
      let contact: string;
      try {
        contact = normalizeRecoveryContact(input.contactType, input.newContact);
      } catch {
        throw new Error("新的联系方式格式无效。");
      }
      const subject = privateValueHash("recovery-target", `${input.contactType}:${contact}`);
      await consumeRateLimit({
        key: rateLimitKey("recovery-send", "ip", ip),
        limit: 10,
        windowMs: ONE_HOUR_MS,
        event: "account_recovery_send_rate_limited",
        subject,
        ip,
      });
      await consumeRateLimit({
        key: rateLimitKey("recovery-send", "target", subject),
        limit: 5,
        windowMs: ONE_HOUR_MS,
        event: "account_recovery_target_rate_limited",
        subject,
        ip,
      });
      await verifyAliyunCaptcha(input.captchaVerifyParam);
      const user = await findRecoverableUser(input.identifier);
      if (!user) return { success: true, message: GENERIC_SEND_MESSAGE };
      await assertRecoveryContactAvailable(input.contactType, contact, user.id);
      if (input.contactType === "email") {
        const code = await createVerificationCode(contact, "recovery_new_email", ip);
        await sendVerificationEmail(contact, code, {
          subject: verificationSubject("recovery_new_email"),
          label: verificationTemplateLabel("recovery_new_email"),
        });
      } else {
        await sendSmsCode(contact, "recovery_new_phone");
      }
      return { success: true, message: GENERIC_SEND_MESSAGE };
    }),

  submit: publicQuery
    .input(z.object({
      identifier: z.string().trim().min(1).max(320),
      contactType: z.enum(["email", "phone"]),
      newContact: z.string().trim().min(1).max(320),
      code: z.string().trim().min(4).max(8),
      recoveryCode: z.string().trim().max(80).optional(),
      newPassword: z.string().max(PASSWORD_MAX_LENGTH).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertRecoveryEnabled();
      const ip = requestIp(ctx.req.headers);
      await consumeRateLimit({
        key: rateLimitKey("recovery-submit", "ip", ip),
        limit: 8,
        windowMs: ONE_HOUR_MS,
        event: "account_recovery_submit_rate_limited",
        ip,
      });
      const user = await findRecoverableUser(input.identifier);
      if (!user) throw new Error("恢复信息无效或已过期。");
      const contact = normalizeRecoveryContact(input.contactType, input.newContact);
      await assertRecoveryContactAvailable(input.contactType, contact, user.id);
      await verifyRecoveryContactCode(input.contactType, contact, input.code);

      if (input.recoveryCode) {
        if (!input.newPassword) throw new Error("请输入新密码。");
        await recoverWithRecoveryCode({
          userId: user.id,
          recoveryCode: input.recoveryCode,
          contactType: input.contactType,
          newContact: contact,
          newPassword: input.newPassword,
        });
        await recordSecurityEvent({
          event: "account_recovered_with_code",
          subject: `user:${user.id}`,
          userId: user.id,
          ip,
        });
        return { success: true, immediate: true, message: "账号已恢复，请使用新密码登录。" };
      }

      const request = await createManualRecoveryRequest({
        user,
        contactType: input.contactType,
        newContact: contact,
        appUrl: appUrl(ctx.req),
        evidence: {
          accountCreatedAt: user.createdAt.toISOString(),
          lastSignInAt: user.lastSignInAt.toISOString(),
          hasVerifiedEmail: Boolean(user.emailVerified && user.email),
          hasVerifiedPhone: Boolean(user.phoneVerified && user.phoneEncrypted),
          requestIp: ip,
          userAgent: ctx.req.headers.get("user-agent")?.slice(0, 255) ?? null,
        },
      });
      await recordSecurityEvent({
        event: "account_recovery_requested",
        subject: `request:${request.id}`,
        userId: user.id,
        ip,
      });
      return {
        success: true,
        immediate: false,
        availableAt: request.availableAt,
        message: "人工恢复申请已提交，72 小时冷静期结束并通过两级审核后会通知新的联系方式。",
      };
    }),

  cancelByToken: publicQuery
    .input(z.object({ token: z.string().min(20).max(200) }))
    .mutation(async ({ input }) => {
      assertRecoveryEnabled();
      await cancelRecoveryByToken(input.token);
      return { success: true };
    }),

  complete: publicQuery
    .input(z.object({
      token: z.string().min(20).max(200),
      newPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    }))
    .mutation(async ({ input }) => {
      assertRecoveryEnabled();
      await completeManualRecovery(input.token, input.newPassword);
      return { success: true };
    }),

  mine: authedQuery.query(({ ctx }) => listOwnRecoveryRequests(ctx.user.id)),

  cancel: authedQuery
    .input(z.object({ requestId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await cancelOwnRecovery(input.requestId, ctx.user.id);
      return { success: true };
    }),
});
