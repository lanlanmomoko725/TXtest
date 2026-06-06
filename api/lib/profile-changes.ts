import { and, desc, eq, gte, lt } from "drizzle-orm";
import { isSafeAvatarUploadPath } from "@contracts/upload-path";
import { assertValidUsername } from "@contracts/username";
import * as schema from "@db/schema";
import type { User } from "@db/schema";
import { getDb } from "../queries/connection";
import { findPublicUsersByIds, findUserById, findUsersByName, updateUser } from "../queries/users";

export type ProfileChangeType = "name" | "avatar";

export function shanghaiYearRange(now = new Date()) {
  const year = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
    }).format(now),
  );
  return {
    start: new Date(Date.UTC(year, 0, 1, -8, 0, 0, 0)),
    end: new Date(Date.UTC(year + 1, 0, 1, -8, 0, 0, 0)),
    year,
  };
}

async function ensureNoPendingRequest(userId: number, type: ProfileChangeType) {
  const [pending] = await getDb()
    .select()
    .from(schema.profileChangeRequests)
    .where(
      and(
        eq(schema.profileChangeRequests.userId, userId),
        eq(schema.profileChangeRequests.type, type),
        eq(schema.profileChangeRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) {
    throw new Error(type === "name" ? "已有待审核的用户名申请。" : "已有待审核的头像申请。");
  }
}

export async function hasApprovedProfileChangeThisYear(userId: number, type: ProfileChangeType) {
  const { start, end } = shanghaiYearRange();
  const rows = await getDb()
    .select({ id: schema.profileChangeRequests.id })
    .from(schema.profileChangeRequests)
    .where(
      and(
        eq(schema.profileChangeRequests.userId, userId),
        eq(schema.profileChangeRequests.type, type),
        eq(schema.profileChangeRequests.status, "approved"),
        gte(schema.profileChangeRequests.reviewedAt, start),
        lt(schema.profileChangeRequests.reviewedAt, end),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function ensureNameAvailableForUser(name: string, userId: number) {
  const rows = await findUsersByName(name);
  if (rows.some((user) => user.id !== userId)) {
    throw new Error("该用户名已被使用，请换一个。");
  }
}

export async function validateProfileChangeRequest(user: User, type: ProfileChangeType, value: string) {
  const nextValue = value.trim();
  if (!nextValue) {
    throw new Error("申请内容不能为空。");
  }

  if (type === "name") {
    assertValidUsername(nextValue);
    if (nextValue === user.name) {
      throw new Error("用户名没有变化。");
    }
    await ensureNameAvailableForUser(nextValue, user.id);
  } else {
    if (nextValue === user.avatar) {
      throw new Error("头像没有变化。");
    }
    if (!isSafeAvatarUploadPath(nextValue)) {
      throw new Error("头像路径无效。");
    }
  }

  await ensureNoPendingRequest(user.id, type);
  if (await hasApprovedProfileChangeThisYear(user.id, type)) {
    throw new Error(type === "name" ? "今年已经更换过用户名。" : "今年已经更换过头像。");
  }

  return nextValue;
}

async function insertProfileChangeRequest(userId: number, type: ProfileChangeType, value: string) {
  const [{ id }] = await getDb().insert(schema.profileChangeRequests).values({
    userId,
    type,
    value,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  }).$returningId();

  return id;
}

export async function createProfileChangeRequest(user: User, type: ProfileChangeType, value: string) {
  const nextValue = await validateProfileChangeRequest(user, type, value);
  return insertProfileChangeRequest(user.id, type, nextValue);
}

export async function createProfileChangeRequests(
  user: User,
  changes: Array<{ type: ProfileChangeType; value: string }>,
) {
  const seenTypes = new Set<ProfileChangeType>();
  const validated: Array<{ type: ProfileChangeType; value: string }> = [];

  for (const change of changes) {
    if (seenTypes.has(change.type)) {
      throw new Error("同一类型资料不能重复提交。");
    }
    seenTypes.add(change.type);
    validated.push({
      type: change.type,
      value: await validateProfileChangeRequest(user, change.type, change.value),
    });
  }

  const ids: number[] = [];
  for (const change of validated) {
    ids.push(await insertProfileChangeRequest(user.id, change.type, change.value));
  }
  return ids;
}

export async function getProfileChangeStatus(userId: number) {
  const { year } = shanghaiYearRange();
  const [pendingName] = await getDb()
    .select()
    .from(schema.profileChangeRequests)
    .where(
      and(
        eq(schema.profileChangeRequests.userId, userId),
        eq(schema.profileChangeRequests.type, "name"),
        eq(schema.profileChangeRequests.status, "pending"),
      ),
    )
    .orderBy(desc(schema.profileChangeRequests.createdAt))
    .limit(1);
  const [pendingAvatar] = await getDb()
    .select()
    .from(schema.profileChangeRequests)
    .where(
      and(
        eq(schema.profileChangeRequests.userId, userId),
        eq(schema.profileChangeRequests.type, "avatar"),
        eq(schema.profileChangeRequests.status, "pending"),
      ),
    )
    .orderBy(desc(schema.profileChangeRequests.createdAt))
    .limit(1);

  return {
    year,
    name: {
      pending: pendingName ?? null,
      usedThisYear: await hasApprovedProfileChangeThisYear(userId, "name"),
    },
    avatar: {
      pending: pendingAvatar ?? null,
      usedThisYear: await hasApprovedProfileChangeThisYear(userId, "avatar"),
    },
  };
}

export async function listPendingProfileChangeRequests() {
  const requests = await getDb()
    .select()
    .from(schema.profileChangeRequests)
    .where(eq(schema.profileChangeRequests.status, "pending"))
    .orderBy(desc(schema.profileChangeRequests.createdAt));
  const userMap = await findPublicUsersByIds(requests.map((request) => request.userId));
  return requests.map((request) => ({
    ...request,
    user: userMap.get(request.userId) || null,
  }));
}

export async function reviewProfileChangeRequest(options: {
  requestId: number;
  reviewerId: number;
  approve: boolean;
  rejectReason?: string;
}) {
  const [request] = await getDb()
    .select()
    .from(schema.profileChangeRequests)
    .where(
      and(
        eq(schema.profileChangeRequests.id, options.requestId),
        eq(schema.profileChangeRequests.status, "pending"),
      ),
    )
    .limit(1);

  if (!request) {
    throw new Error("待审核申请不存在或已处理。");
  }

  if (!options.approve) {
    await getDb()
      .update(schema.profileChangeRequests)
      .set({
        status: "rejected",
        reviewedBy: options.reviewerId,
        reviewedAt: new Date(),
        rejectReason: options.rejectReason?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.profileChangeRequests.id, request.id));
    return { success: true, request, applied: false };
  }

  const user = await findUserById(request.userId);
  if (!user) {
    throw new Error("申请用户不存在。");
  }

  if (request.type === "name") {
    assertValidUsername(request.value);
    await ensureNameAvailableForUser(request.value, user.id);
    await updateUser(user.id, { name: request.value });
  } else if (request.type === "avatar") {
    if (!isSafeAvatarUploadPath(request.value)) {
      throw new Error("头像路径无效。");
    }
    await updateUser(user.id, { avatar: request.value });
  }

  await getDb()
    .update(schema.profileChangeRequests)
    .set({
      status: "approved",
      reviewedBy: options.reviewerId,
      reviewedAt: new Date(),
      rejectReason: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.profileChangeRequests.id, request.id));

  return { success: true, request, applied: true };
}
