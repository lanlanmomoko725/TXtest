import type { User } from "@db/schema";
import { maskEncryptedPhone } from "./identity";

export type PublicUser = Pick<User, "id" | "publicId" | "name" | "avatar" | "role" | "level" | "createdAt">;

export type CurrentUser = {
  id: number;
  publicId: number | null;
  name: string | null;
  email: string | null;
  phoneMasked: string | null;
  avatar: string | null;
  role: User["role"];
  level: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt: Date;
};

export type AdminUser = CurrentUser;

type UserLike = Pick<
  User,
  | "id"
  | "publicId"
  | "name"
  | "email"
  | "phoneEncrypted"
  | "avatar"
  | "role"
  | "level"
  | "emailVerified"
  | "phoneVerified"
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
    phoneMasked: maskEncryptedPhone(user.phoneEncrypted),
    avatar: user.avatar,
    role: user.role,
    level: user.level,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    lockedUntil: user.lockedUntil,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastSignInAt: user.lastSignInAt,
  };
}

export function toAdminUser(user: UserLike | null | undefined): AdminUser | null {
  return toCurrentUser(user);
}
