import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  boolean,
  int,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  publicId: int("publicId").unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }).unique(),
  phoneHash: varchar("phoneHash", { length: 128 }).unique(),
  phoneEncrypted: text("phoneEncrypted"),
  password: varchar("password", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin", "super_admin"]).default("user").notNull(),
  level: int("level").default(0).notNull(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  phoneVerified: boolean("phoneVerified").default(false).notNull(),
  sessionVersion: int("sessionVersion").default(1).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const verificationCodes = mysqlTable("verificationCodes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  purpose: mysqlEnum("purpose", ["register", "reset_password", "bind_email"]).notNull(),
  codeHash: varchar("codeHash", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  attempts: int("attempts").default(0).notNull(),
  consumedAt: timestamp("consumedAt"),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VerificationCode = typeof verificationCodes.$inferSelect;

export const accountIdSequences = mysqlTable("account_id_sequences", {
  name: varchar("name", { length: 50 }).primaryKey(),
  nextValue: int("nextValue").notNull(),
  maxValue: int("maxValue").notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AccountIdSequence = typeof accountIdSequences.$inferSelect;

export const adminEmailAllowlist = mysqlTable("admin_email_allowlist", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).unique().notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedBy: bigint("usedBy", { mode: "number", unsigned: true }),
  usedAt: timestamp("usedAt"),
});

export type AdminEmailAllowlist = typeof adminEmailAllowlist.$inferSelect;

export const loginAttempts = mysqlTable("login_attempts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  ip: varchar("ip", { length: 45 }).notNull(),
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;

export const sessions = mysqlTable("sessions", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).unique().notNull(),
  ip: varchar("ip", { length: 45 }),
  userAgent: varchar("userAgent", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
});

export type SessionRecord = typeof sessions.$inferSelect;

export const rateLimitBuckets = mysqlTable("rate_limit_buckets", {
  key: varchar("key", { length: 255 }).primaryKey(),
  count: int("count").default(0).notNull(),
  resetAt: timestamp("resetAt").notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;

export const auditLogs = mysqlTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  targetType: varchar("targetType", { length: 50 }).notNull(),
  targetId: varchar("targetId", { length: 255 }),
  details: json("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;

export const securityEvents = mysqlTable("security_events", {
  id: serial("id").primaryKey(),
  event: varchar("event", { length: 80 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  ip: varchar("ip", { length: 45 }),
  details: json("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SecurityEvent = typeof securityEvents.$inferSelect;

export const posts = mysqlTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull(),
  category: mysqlEnum("category", ["cloud_types", "rainbow", "glory", "ice_halo", "mirage", "lightning", "sky_color"]).notNull(),
  region: varchar("region", { length: 50 }),
  hasLocation: boolean("hasLocation").default(false).notNull(),
  images: json("images").$type<string[] | null>(),
  isArticle: boolean("isArticle").default(false).notNull(),
  isSkyExplanation: boolean("isSkyExplanation").default(false).notNull(),
  skyGalleryCategory: varchar("skyGalleryCategory", { length: 50 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  tags: json("tags").$type<string[] | null>(),
  isFeatured: boolean("isFeatured").default(false).notNull(),
  viewCount: int("viewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

export const comments = mysqlTable("comments", {
  id: serial("id").primaryKey(),
  postId: bigint("postId", { mode: "number", unsigned: true }).notNull(),
  authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull(),
  parentId: bigint("parentId", { mode: "number", unsigned: true }),
  replyToUserId: bigint("replyToUserId", { mode: "number", unsigned: true }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

export const weeklySkies = mysqlTable("weekly_skies", {
  id: serial("id").primaryKey(),
  image: text("image"),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type WeeklySky = typeof weeklySkies.$inferSelect;
export type InsertWeeklySky = typeof weeklySkies.$inferInsert;

export const aboutUs = mysqlTable("about_us", {
  id: serial("id").primaryKey(),
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AboutUs = typeof aboutUs.$inferSelect;
export type InsertAboutUs = typeof aboutUs.$inferInsert;
