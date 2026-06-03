import type { User } from "@db/schema";

export type PublicUser = Pick<User, "id" | "publicId" | "name" | "avatar" | "role" | "level" | "createdAt">;

export type CurrentUser = Pick<
  User,
  | "id"
  | "publicId"
  | "name"
  | "email"
  | "avatar"
  | "role"
  | "level"
  | "emailVerified"
  | "lockedUntil"
  | "createdAt"
  | "updatedAt"
  | "lastSignInAt"
>;

export type AdminUser = CurrentUser;

type UserLike = Pick<
  User,
  | "id"
  | "publicId"
  | "name"
  | "email"
  | "avatar"
  | "role"
  | "level"
  | "emailVerified"
  | "lockedUntil"
  | "createdAt"
  | "updatedAt"
  | "lastSignInAt"
>;

export function toPublicUser(user: Pick<User, "id" | "publicId" | "name" | "avatar" | "role" | "level" | "createdAt"> | null | undefined): PublicUser | null {
  if (!user) return null;
  return {
    id: user.id,
    publicId: user.publicId,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    level: user.level,
    createdAt: user.createdAt,
  };
}

export function toCurrentUser(user: UserLike | null | undefined): CurrentUser | null {
  if (!user) return null;
  return {
    id: user.id,
    publicId: user.publicId,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    level: user.level,
    emailVerified: user.emailVerified,
    lockedUntil: user.lockedUntil,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignInAt: user.lastSignInAt,
  };
}

export function toAdminUser(user: UserLike | null | undefined): AdminUser | null {
  return toCurrentUser(user);
}
