import { count, eq, inArray, or } from "drizzle-orm";
import * as schema from "@db/schema";

import { getDb } from "./connection";
import { toAdminUser, toPublicUser } from "../lib/user-dto";
import { encryptIdentity, normalizeEmail, normalizePhone, phoneHash } from "../lib/identity";

export type UserRole = "user" | "admin" | "super_admin";

export async function findUserById(id: number) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return rows.at(0);
}

export async function findUserByEmail(email: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizeEmail(email)))
    .limit(1);
  return rows.at(0);
}

export async function findUserByPhone(phone: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.phoneHash, phoneHash(phone)))
    .limit(1);
  return rows.at(0);
}

export async function findUsersByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return [];
  return getDb().select().from(schema.users).where(eq(schema.users.name, trimmed)).limit(2);
}

export async function findUserByLoginIdentifier(identifier: string) {
  const value = identifier.trim();
  if (!value) return null;

  if (value.includes("@")) {
    return findUserByEmail(value);
  }

  try {
    return await findUserByPhone(value);
  } catch {
    // Not a phone-like identifier, fall through to username.
  }

  const users = await findUsersByName(value);
  if (users.length > 1) {
    throw new Error("用户名不唯一，请改用邮箱或手机号登录。");
  }
  return users[0] ?? null;
}

export async function createEmailUser(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  avatar?: string;
  role?: UserRole;
  publicId?: number;
  level?: number;
}) {
  const [{ id }] = await getDb()
    .insert(schema.users)
    .values({
      name: data.name,
      email: data.email ? normalizeEmail(data.email) : null,
      phoneHash: data.phone ? phoneHash(data.phone) : null,
      phoneEncrypted: data.phone ? encryptIdentity(normalizePhone(data.phone)) : null,
      password: data.password,
      avatar: data.avatar || null,
      role: data.role || "user",
      publicId: data.publicId ?? null,
      level: data.level ?? (data.role === "admin" || data.role === "super_admin" ? 99 : 0),
      emailVerified: Boolean(data.email),
      phoneVerified: Boolean(data.phone),
      sessionVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignInAt: new Date(),
    })
    .$returningId();

  return findUserById(id);
}

export async function updateUser(
  id: number,
  data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    avatar?: string;
    role?: UserRole;
    level?: number;
    emailVerified?: boolean;
    phoneVerified?: boolean;
    sessionVersion?: number;
    lockedUntil?: Date | null;
  }
) {
  const { phone, email, ...rest } = data;
  await getDb()
    .update(schema.users)
    .set({
      ...rest,
      ...(email !== undefined ? { email: email ? normalizeEmail(email) : null } : {}),
      ...(phone !== undefined
        ? {
            phoneHash: phone ? phoneHash(phone) : null,
            phoneEncrypted: phone ? encryptIdentity(normalizePhone(phone)) : null,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, id));
  return findUserById(id);
}

export async function listUsers(options?: { offset?: number; limit?: number }) {
  const { offset = 0, limit = 50 } = options ?? {};
  const rows = await getDb()
    .select()
    .from(schema.users)
    .orderBy(schema.users.createdAt)
    .limit(limit)
    .offset(offset);
  return rows.map(toAdminUser).filter((user) => user !== null);
}

export async function countUsers(): Promise<number> {
  const result = await getDb()
    .select({ value: count() })
    .from(schema.users);
  return result[0]?.value ?? 0;
}

export async function findAdminCount(): Promise<number> {
  const result = await getDb()
    .select({ value: count() })
    .from(schema.users)
    .where(or(eq(schema.users.role, "admin"), eq(schema.users.role, "super_admin")));
  return result[0]?.value ?? 0;
}

export async function findPublicUsersByIds(ids: number[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const rows = await getDb()
    .select({
      id: schema.users.id,
      publicId: schema.users.publicId,
      name: schema.users.name,
      avatar: schema.users.avatar,
      role: schema.users.role,
      level: schema.users.level,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, uniqueIds));

  return new Map(rows.map((row) => [row.id, toPublicUser(row)]));
}

export async function deleteUser(id: number) {
  await getDb()
    .delete(schema.users)
    .where(eq(schema.users.id, id));
}
