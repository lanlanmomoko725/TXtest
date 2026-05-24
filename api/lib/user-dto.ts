import type { User } from "@db/schema";

export type PublicUser = Pick<User, "id" | "name" | "avatar" | "role" | "createdAt">;

export type CurrentUser = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "avatar"
  | "role"
  | "emailVerified"
  | "createdAt"
  | "updatedAt"
  | "lastSignInAt"
>;

export type AdminUser = CurrentUser;

type UserLike = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "avatar"
  | "role"
  | "emailVerified"
  | "createdAt"
  | "updatedAt"
  | "lastSignInAt"
>;

export function toPublicUser(user: Pick<User, "id" | "name" | "avatar" | "role" | "createdAt"> | null | undefined): PublicUser | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function toCurrentUser(user: UserLike | null | undefined): CurrentUser | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignInAt: user.lastSignInAt,
  };
}

export function toAdminUser(user: UserLike | null | undefined): AdminUser | null {
  return toCurrentUser(user);
}
