import { eq } from "drizzle-orm";
import * as schema from "@db/schema";

import { getDb } from "./connection";

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
  role?: "user" | "admin";
}) {
  const [{ id }] = await getDb()
    .insert(schema.users)
    .values({
      name: data.name,
      email: data.email,
      password: data.password,
      avatar: data.avatar || null,
      role: data.role || "user",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignInAt: new Date(),
    })
    .$returningId();

  return findUserById(id);
}

export async function updateUser(
  id: number,
  data: { name?: string; avatar?: string; role?: "user" | "admin" }
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
  return rows;
}

export async function countUsers(): Promise<number> {
  const result = await getDb()
    .select({ count: schema.users.id })
    .from(schema.users);
  return result.length;
}

export async function findAdminCount(): Promise<number> {
  const result = await getDb()
    .select({ count: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"));
  return result.length;
}
