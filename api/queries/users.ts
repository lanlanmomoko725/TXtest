import { count, eq, inArray, or } from "drizzle-orm";
import * as schema from "@db/schema";

import { getDb } from "./connection";
import { toAdminUser, toPublicUser } from "../lib/user-dto";

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
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows.at(0);
}

export async function createEmailUser(data: {
  name: string;
  email: string;
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
      email: data.email,
      password: data.password,
      avatar: data.avatar || null,
      role: data.role || "user",
      publicId: data.publicId ?? null,
      level: data.level ?? (data.role === "admin" || data.role === "super_admin" ? 99 : 0),
      emailVerified: true,
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
  data: { name?: string; avatar?: string; role?: UserRole; level?: number; sessionVersion?: number; lockedUntil?: Date | null }
) {
  await getDb()
    .update(schema.users)
    .set({
      ...data,
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
