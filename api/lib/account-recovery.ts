import bcrypt from "bcryptjs";
import { and, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { findUserByLoginIdentifier } from "../queries/users";
import { createOpaqueToken, hashOpaqueToken, recoveryCodeHash } from "./account-security";
import { requireSingleAffectedRow } from "./db-result";
import { decryptIdentity, encryptIdentity, normalizeEmail, normalizePhone, phoneHash, privateValueHash } from "./identity";
import { enqueueSecurityNotification } from "./notifications";
import { assertPasswordPolicy } from "./password-policy";

const MANUAL_RECOVERY_DELAY_MS = 72 * 60 * 60 * 1000;
const COMPLETION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const ACTIVE_RECOVERY_STATUSES = ["pending", "initial_approved", "final_approved"] as const;

export type RecoveryContactType = "email" | "phone";

export function normalizeRecoveryContact(type: RecoveryContactType, value: string) {
  if (type === "email") {
    const email = normalizeEmail(value);
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("请输入有效邮箱地址。");
    }
    return email;
  }
  return normalizePhone(value);
}

export function hashRecoveryContact(type: RecoveryContactType, value: string) {
  return privateValueHash(`account-recovery:${type}`, normalizeRecoveryContact(type, value));
}

export function maskRecoveryContact(type: RecoveryContactType, value: string) {
  if (type === "email") {
    const [name, domain] = value.split("@");
    if (!domain) return "***";
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return value.length >= 7 ? `${value.slice(0, 3)}****${value.slice(-4)}` : "***";
}

export function assertFinalReviewPolicy(params: {
  availableAt: Date;
  initialReviewerId: number;
  finalReviewerId: number;
  now?: Date;
}) {
  if (params.availableAt > (params.now ?? new Date())) throw new Error("72 小时冷静期尚未结束。");
  if (params.initialReviewerId === params.finalReviewerId) throw new Error("终审必须由不同账号完成。");
}

export async function findRecoverableUser(identifier: string) {
  const user = await findUserByLoginIdentifier(identifier);
  if (!user || user.deletedAt || user.role !== "user" || user.level >= 99) return null;
  return user;
}

export async function assertRecoveryContactAvailable(
  type: RecoveryContactType,
  value: string,
  exceptUserId: number,
  executor: any = getDb(),
) {
  const normalized = normalizeRecoveryContact(type, value);
  const rows = type === "email"
    ? await executor.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, normalized)).limit(1)
    : await executor.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.phoneHash, phoneHash(normalized))).limit(1);
  if (rows[0] && rows[0].id !== exceptUserId) throw new Error("新的联系方式已经被其他账号使用。");
  return normalized;
}

function contactUpdate(type: RecoveryContactType, value: string) {
  if (type === "email") {
    return { email: value, emailVerified: true } as const;
  }
  return {
    phoneHash: phoneHash(value),
    phoneEncrypted: encryptIdentity(value),
    phoneVerified: true,
  } as const;
}

async function enqueueSafely(params: Parameters<typeof enqueueSecurityNotification>[0]) {
  try {
    await enqueueSecurityNotification(params);
  } catch (error) {
    console.error("[account-recovery] Failed to enqueue security notification", error);
  }
}

async function notifyOldContacts(user: typeof schema.users.$inferSelect, cancelUrl: string) {
  if (user.email && user.emailVerified) {
    await enqueueSafely({
      channel: "email",
      destination: user.email,
      template: "recovery_alert",
      payload: { cancelUrl },
    });
  }
  const phone = decryptIdentity(user.phoneEncrypted);
  if (phone && user.phoneVerified) {
    await enqueueSafely({
      channel: "sms",
      destination: phone,
      template: "recovery_alert",
      payload: { cancelUrl },
    });
  }
}

export async function recoverWithRecoveryCode(params: {
  userId: number;
  recoveryCode: string;
  contactType: RecoveryContactType;
  newContact: string;
  newPassword: string;
}) {
  assertPasswordPolicy(params.newPassword);
  const normalized = normalizeRecoveryContact(params.contactType, params.newContact);
  const hashedPassword = await bcrypt.hash(params.newPassword, 10);
  const [oldUser] = await getDb().select().from(schema.users).where(eq(schema.users.id, params.userId)).limit(1);
  if (!oldUser || oldUser.deletedAt || oldUser.role !== "user" || oldUser.level >= 99) {
    throw new Error("恢复信息无效或已过期。");
  }
  await getDb().transaction(async (tx) => {
    await assertRecoveryContactAvailable(params.contactType, normalized, params.userId, tx);
    const [user] = await tx.select({
      sessionVersion: schema.users.sessionVersion,
      role: schema.users.role,
      level: schema.users.level,
      deletedAt: schema.users.deletedAt,
    })
      .from(schema.users).where(eq(schema.users.id, params.userId)).for("update");
    if (!user || user.deletedAt || user.role !== "user" || user.level >= 99) {
      throw new Error("恢复信息无效或已过期。");
    }
    const [code] = await tx
      .select()
      .from(schema.recoveryCodes)
      .where(
        and(
          eq(schema.recoveryCodes.userId, params.userId),
          eq(schema.recoveryCodes.codeHash, recoveryCodeHash(params.recoveryCode)),
          isNull(schema.recoveryCodes.consumedAt),
        ),
      )
      .limit(1);
    if (!code) throw new Error("恢复信息无效或已过期。");
    const consumeResult = await tx
      .update(schema.recoveryCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(schema.recoveryCodes.id, code.id), isNull(schema.recoveryCodes.consumedAt)));
    requireSingleAffectedRow(consumeResult, "恢复信息无效或已过期。");
    await tx.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, params.userId));
    await tx
      .update(schema.users)
      .set({
        ...contactUpdate(params.contactType, normalized),
        password: hashedPassword,
        sessionVersion: user.sessionVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, params.userId));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, params.userId));
  });
  const destinations = new Map<string, "email" | "sms">();
  if (oldUser.email && oldUser.emailVerified) destinations.set(oldUser.email, "email");
  const oldPhone = decryptIdentity(oldUser.phoneEncrypted);
  if (oldPhone && oldUser.phoneVerified) destinations.set(oldPhone, "sms");
  destinations.set(normalized, params.contactType === "email" ? "email" : "sms");
  for (const [destination, channel] of destinations) {
    await enqueueSafely({
      channel,
      destination,
      template: "contact_changed",
      payload: { contactLabel: params.contactType === "email" ? "邮箱" : "手机号" },
    });
  }
}

export async function createManualRecoveryRequest(params: {
  user: typeof schema.users.$inferSelect;
  contactType: RecoveryContactType;
  newContact: string;
  evidence: Record<string, unknown>;
  appUrl: string;
}) {
  const normalized = normalizeRecoveryContact(params.contactType, params.newContact);
  const cancelToken = createOpaqueToken();
  const now = new Date();
  const id = await getDb().transaction(async (tx) => {
    const [lockedUser] = await tx.select({
      id: schema.users.id,
      role: schema.users.role,
      level: schema.users.level,
      deletedAt: schema.users.deletedAt,
    }).from(schema.users)
      .where(eq(schema.users.id, params.user.id)).for("update");
    if (!lockedUser || lockedUser.deletedAt || lockedUser.role !== "user" || lockedUser.level >= 99) {
      throw new Error("管理员账号必须通过线下运维流程恢复。");
    }
    await assertRecoveryContactAvailable(params.contactType, normalized, params.user.id, tx);
    const [existing] = await tx.select({ id: schema.accountRecoveryRequests.id })
      .from(schema.accountRecoveryRequests)
      .where(and(
        eq(schema.accountRecoveryRequests.userId, params.user.id),
        inArray(schema.accountRecoveryRequests.status, [...ACTIVE_RECOVERY_STATUSES]),
      )).limit(1);
    if (existing) throw new Error("该账号已有进行中的恢复申请。");
    const [{ id: requestId }] = await tx.insert(schema.accountRecoveryRequests).values({
      userId: params.user.id,
      contactType: params.contactType,
      newContactHash: hashRecoveryContact(params.contactType, normalized),
      newContactEncrypted: encryptIdentity(normalized),
      evidence: params.evidence,
      availableAt: new Date(now.getTime() + MANUAL_RECOVERY_DELAY_MS),
      cancelTokenHash: hashOpaqueToken("recovery-cancel", cancelToken),
      createdAt: now,
      updatedAt: now,
    }).$returningId();
    return requestId;
  });
  const baseUrl = params.appUrl.replace(/\/$/, "");
  await notifyOldContacts(params.user, `${baseUrl}/account-recovery?cancel=${encodeURIComponent(cancelToken)}`);
  return { id, availableAt: new Date(now.getTime() + MANUAL_RECOVERY_DELAY_MS) };
}

export async function cancelRecoveryByToken(token: string) {
  const result = await getDb()
    .update(schema.accountRecoveryRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(schema.accountRecoveryRequests.cancelTokenHash, hashOpaqueToken("recovery-cancel", token)),
        inArray(schema.accountRecoveryRequests.status, [...ACTIVE_RECOVERY_STATUSES]),
      ),
    );
  requireSingleAffectedRow(result, "恢复申请不存在、已完成或已取消。");
}

export async function cancelOwnRecovery(requestId: number, userId: number) {
  const result = await getDb()
    .update(schema.accountRecoveryRequests)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(schema.accountRecoveryRequests.id, requestId),
        eq(schema.accountRecoveryRequests.userId, userId),
        inArray(schema.accountRecoveryRequests.status, [...ACTIVE_RECOVERY_STATUSES]),
      ),
    );
  requireSingleAffectedRow(result, "恢复申请不存在、已完成或已取消。");
}

export async function listOwnRecoveryRequests(userId: number) {
  return getDb().select({
    id: schema.accountRecoveryRequests.id,
    contactType: schema.accountRecoveryRequests.contactType,
    status: schema.accountRecoveryRequests.status,
    availableAt: schema.accountRecoveryRequests.availableAt,
    createdAt: schema.accountRecoveryRequests.createdAt,
  }).from(schema.accountRecoveryRequests)
    .where(eq(schema.accountRecoveryRequests.userId, userId))
    .orderBy(desc(schema.accountRecoveryRequests.createdAt));
}

export async function listRecoveryRequestsForReview() {
  const requests = await getDb().select().from(schema.accountRecoveryRequests)
    .where(inArray(schema.accountRecoveryRequests.status, ["pending", "initial_approved"]))
    .orderBy(schema.accountRecoveryRequests.availableAt);
  if (requests.length === 0) return [];
  const userIds = [...new Set(requests.map((item) => item.userId))];
  const requestIds = requests.map((item) => item.id);
  const [users, reviews] = await Promise.all([
    getDb().select({
      id: schema.users.id,
      publicId: schema.users.publicId,
      name: schema.users.name,
      role: schema.users.role,
      level: schema.users.level,
      createdAt: schema.users.createdAt,
      lastSignInAt: schema.users.lastSignInAt,
    }).from(schema.users).where(inArray(schema.users.id, userIds)),
    getDb().select().from(schema.accountRecoveryReviews)
      .where(inArray(schema.accountRecoveryReviews.requestId, requestIds)),
  ]);
  const userMap = new Map(users.map((user) => [user.id, user]));
  return requests.map((request) => {
    const contact = decryptIdentity(request.newContactEncrypted) ?? "";
    return {
      ...request,
      newContactEncrypted: undefined,
      cancelTokenHash: undefined,
      newContactMasked: maskRecoveryContact(request.contactType, contact),
      user: userMap.get(request.userId) ?? null,
      reviews: reviews.filter((review) => review.requestId === request.id),
    };
  });
}

export async function initialReviewRecovery(params: {
  requestId: number;
  reviewerId: number;
  approve: boolean;
  reason?: string;
}) {
  await getDb().transaction(async (tx) => {
    const [requestPreview] = await tx.select({ userId: schema.accountRecoveryRequests.userId })
      .from(schema.accountRecoveryRequests).where(eq(schema.accountRecoveryRequests.id, params.requestId)).limit(1);
    if (!requestPreview) throw new Error("恢复申请状态已发生变化。");
    const [targetUser] = await tx.select({
      role: schema.users.role,
      level: schema.users.level,
      deletedAt: schema.users.deletedAt,
    }).from(schema.users).where(eq(schema.users.id, requestPreview.userId)).for("update");
    if (!targetUser || targetUser.deletedAt || targetUser.role !== "user" || targetUser.level >= 99) {
      throw new Error("管理员账号必须通过线下运维流程恢复。");
    }
    const [request] = await tx.select().from(schema.accountRecoveryRequests)
      .where(eq(schema.accountRecoveryRequests.id, params.requestId)).for("update");
    if (!request || request.status !== "pending") throw new Error("恢复申请状态已发生变化。");
    await tx.insert(schema.accountRecoveryReviews).values({
      requestId: params.requestId,
      reviewerId: params.reviewerId,
      stage: "initial",
      decision: params.approve ? "approve" : "reject",
      reason: params.reason?.trim() || null,
      createdAt: new Date(),
    });
    const updateResult = await tx.update(schema.accountRecoveryRequests).set({
      status: params.approve ? "initial_approved" : "rejected",
      rejectReason: params.approve ? null : params.reason?.trim() || "初审拒绝",
      updatedAt: new Date(),
    }).where(and(eq(schema.accountRecoveryRequests.id, params.requestId), eq(schema.accountRecoveryRequests.status, "pending")));
    requireSingleAffectedRow(updateResult, "恢复申请状态已发生变化。");
  });
}

export async function finalReviewRecovery(params: {
  requestId: number;
  reviewerId: number;
  approve: boolean;
  reason?: string;
  appUrl: string;
}) {
  const completion = await getDb().transaction(async (tx) => {
    const [requestPreview] = await tx.select({ userId: schema.accountRecoveryRequests.userId })
      .from(schema.accountRecoveryRequests).where(eq(schema.accountRecoveryRequests.id, params.requestId)).limit(1);
    if (!requestPreview) throw new Error("恢复申请尚未通过初审或状态已变化。");
    const [targetUser] = await tx.select({
      role: schema.users.role,
      level: schema.users.level,
      deletedAt: schema.users.deletedAt,
    }).from(schema.users).where(eq(schema.users.id, requestPreview.userId)).for("update");
    if (!targetUser || targetUser.deletedAt || targetUser.role !== "user" || targetUser.level >= 99) {
      throw new Error("管理员账号必须通过线下运维流程恢复。");
    }
    const [request] = await tx.select().from(schema.accountRecoveryRequests)
      .where(eq(schema.accountRecoveryRequests.id, params.requestId)).for("update");
    if (!request || request.status !== "initial_approved") throw new Error("恢复申请尚未通过初审或状态已变化。");
    const [initial] = await tx.select().from(schema.accountRecoveryReviews)
      .where(and(
        eq(schema.accountRecoveryReviews.requestId, params.requestId),
        eq(schema.accountRecoveryReviews.stage, "initial"),
        eq(schema.accountRecoveryReviews.decision, "approve"),
      )).limit(1);
    if (!initial) throw new Error("未找到有效的初审记录。");
    assertFinalReviewPolicy({
      availableAt: request.availableAt,
      initialReviewerId: initial.reviewerId,
      finalReviewerId: params.reviewerId,
    });
    await tx.insert(schema.accountRecoveryReviews).values({
      requestId: params.requestId,
      reviewerId: params.reviewerId,
      stage: "final",
      decision: params.approve ? "approve" : "reject",
      reason: params.reason?.trim() || null,
      createdAt: new Date(),
    });
    const updateResult = await tx.update(schema.accountRecoveryRequests).set({
      status: params.approve ? "final_approved" : "rejected",
      rejectReason: params.approve ? null : params.reason?.trim() || "终审拒绝",
      updatedAt: new Date(),
    }).where(and(
      eq(schema.accountRecoveryRequests.id, params.requestId),
      eq(schema.accountRecoveryRequests.status, "initial_approved"),
      lte(schema.accountRecoveryRequests.availableAt, new Date()),
    ));
    requireSingleAffectedRow(updateResult, "恢复申请状态已发生变化。");
    if (params.approve) {
      const token = createOpaqueToken();
      await tx.insert(schema.recoveryCompletionTokens).values({
        requestId: params.requestId,
        tokenHash: hashOpaqueToken("recovery-completion", token),
        expiresAt: new Date(Date.now() + COMPLETION_TOKEN_TTL_MS),
        createdAt: new Date(),
      });
      return {
        token,
        destination: decryptIdentity(request.newContactEncrypted) ?? "",
        channel: request.contactType,
      };
    }
    return null;
  });
  if (completion && completion.destination) {
    const baseUrl = params.appUrl.replace(/\/$/, "");
    await enqueueSafely({
      channel: completion.channel === "email" ? "email" : "sms",
      destination: completion.destination,
      template: "recovery_complete",
      payload: { completeUrl: `${baseUrl}/account-recovery?complete=${encodeURIComponent(completion.token)}` },
    });
  }
}

export async function completeManualRecovery(token: string, newPassword: string) {
  assertPasswordPolicy(newPassword);
  const password = await bcrypt.hash(newPassword, 10);
  await getDb().transaction(async (tx) => {
    const [completion] = await tx.select().from(schema.recoveryCompletionTokens)
      .where(and(
        eq(schema.recoveryCompletionTokens.tokenHash, hashOpaqueToken("recovery-completion", token)),
        isNull(schema.recoveryCompletionTokens.consumedAt),
      )).limit(1);
    if (!completion || completion.expiresAt <= new Date()) throw new Error("完成凭证无效或已过期。");
    const [requestPreview] = await tx.select({ userId: schema.accountRecoveryRequests.userId })
      .from(schema.accountRecoveryRequests).where(eq(schema.accountRecoveryRequests.id, completion.requestId)).limit(1);
    if (!requestPreview) throw new Error("恢复申请状态无效。");
    const [user] = await tx.select({
      sessionVersion: schema.users.sessionVersion,
      role: schema.users.role,
      level: schema.users.level,
      deletedAt: schema.users.deletedAt,
    })
      .from(schema.users).where(eq(schema.users.id, requestPreview.userId)).for("update");
    if (!user || user.deletedAt || user.role !== "user" || user.level >= 99) {
      throw new Error("管理员账号必须通过线下运维流程恢复。");
    }
    const [request] = await tx.select().from(schema.accountRecoveryRequests)
      .where(eq(schema.accountRecoveryRequests.id, completion.requestId)).for("update");
    if (!request || request.status !== "final_approved") throw new Error("恢复申请状态无效。");
    const contact = decryptIdentity(request.newContactEncrypted);
    if (!contact || hashRecoveryContact(request.contactType, contact) !== request.newContactHash) {
      throw new Error("恢复联系方式校验失败。");
    }
    await assertRecoveryContactAvailable(request.contactType, contact, request.userId, tx);
    const consumeResult = await tx.update(schema.recoveryCompletionTokens)
      .set({ consumedAt: new Date() })
      .where(and(eq(schema.recoveryCompletionTokens.id, completion.id), isNull(schema.recoveryCompletionTokens.consumedAt)));
    requireSingleAffectedRow(consumeResult, "完成凭证已使用。");
    await tx.update(schema.users).set({
      ...contactUpdate(request.contactType, contact),
      password,
      sessionVersion: user.sessionVersion + 1,
      updatedAt: new Date(),
    }).where(eq(schema.users.id, request.userId));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, request.userId));
    const requestResult = await tx.update(schema.accountRecoveryRequests).set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(schema.accountRecoveryRequests.id, request.id),
      eq(schema.accountRecoveryRequests.status, "final_approved"),
    ));
    requireSingleAffectedRow(requestResult, "恢复申请状态已发生变化。");
  });
}
