import {
  type AnyMySqlColumn,
  foreignKey,
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
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

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
  deletedAt: timestamp("deletedAt"),
  deletedBy: bigint("deletedBy", { mode: "number", unsigned: true }).references(
    (): AnyMySqlColumn => users.id,
    { onDelete: "set null" },
  ),
  deletionReason: varchar("deletionReason", { length: 255 }),
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
  purpose: mysqlEnum("purpose", [
    "register",
    "reset_password",
    "bind_email",
    "bind_email_old",
    "bind_email_new",
    "recovery_new_email",
  ]).notNull(),
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
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedBy: bigint("usedBy", { mode: "number", unsigned: true }),
  usedAt: timestamp("usedAt"),
}, (table) => ({
  createdByFk: foreignKey({
    name: "admin_allowlist_createdBy_users_id_fk",
    columns: [table.createdBy],
    foreignColumns: [users.id],
  }).onDelete("set null"),
  usedByFk: foreignKey({
    name: "admin_allowlist_usedBy_users_id_fk",
    columns: [table.usedBy],
    foreignColumns: [users.id],
  }).onDelete("set null"),
}));

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
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
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
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "restrict",
  }),
  actorPublicId: int("actorPublicId"),
  actorRole: varchar("actorRole", { length: 32 }),
  actorName: varchar("actorName", { length: 255 }),
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
  userId: bigint("userId", { mode: "number", unsigned: true }).references(() => users.id, {
    onDelete: "set null",
  }),
  ip: varchar("ip", { length: 45 }),
  details: json("details").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SecurityEvent = typeof securityEvents.$inferSelect;

export const profileChangeRequests = mysqlTable("profile_change_requests", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  type: mysqlEnum("type", ["name", "avatar"]).notNull(),
  value: text("value").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedBy: bigint("reviewedBy", { mode: "number", unsigned: true }),
  reviewedAt: timestamp("reviewedAt"),
  rejectReason: varchar("rejectReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => ({
  userFk: foreignKey({
    name: "profile_changes_userId_users_id_fk",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("restrict"),
  reviewedByFk: foreignKey({
    name: "profile_changes_reviewedBy_users_id_fk",
    columns: [table.reviewedBy],
    foreignColumns: [users.id],
  }).onDelete("set null"),
}));

export type ProfileChangeRequest = typeof profileChangeRequests.$inferSelect;

export const uploadedFiles = mysqlTable("uploaded_files", {
  id: serial("id").primaryKey(),
  path: varchar("path", { length: 255 }).unique().notNull(),
  uploaderUserId: bigint("uploaderUserId", { mode: "number", unsigned: true }).notNull(),
  purpose: mysqlEnum("purpose", ["avatar", "content"]).notNull(),
  sizeBytes: int("sizeBytes", { unsigned: true }).notNull(),
  format: varchar("format", { length: 16 }).notNull(),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  uploaderIdx: index("uploaded_files_uploader_idx").on(table.uploaderUserId, table.createdAt),
  uploaderFk: foreignKey({
    name: "uploaded_files_uploader_users_id_fk",
    columns: [table.uploaderUserId],
    foreignColumns: [users.id],
  }).onDelete("restrict"),
}));

export type UploadedFile = typeof uploadedFiles.$inferSelect;

export const smsVerificationChallenges = mysqlTable("sms_verification_challenges", {
  id: serial("id").primaryKey(),
  phoneHash: varchar("phoneHash", { length: 128 }).notNull(),
  purpose: varchar("purpose", { length: 50 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  subjectIdx: index("sms_challenges_subject_idx").on(table.phoneHash, table.purpose, table.createdAt),
}));

export const stepUpGrants = mysqlTable("step_up_grants", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  action: mysqlEnum("action", ["bind_email", "bind_phone", "recovery_codes"]).notNull(),
  targetHash: varchar("targetHash", { length: 128 }).notNull(),
  method: mysqlEnum("method", ["password", "email", "phone"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  tokenUnique: uniqueIndex("step_up_grants_token_unique").on(table.tokenHash),
  userIdx: index("step_up_grants_user_idx").on(table.userId, table.createdAt),
}));

export const recoveryCodes = mysqlTable("recovery_codes", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  codeHash: varchar("codeHash", { length: 128 }).notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  hashUnique: uniqueIndex("recovery_codes_hash_unique").on(table.codeHash),
  userIdx: index("recovery_codes_user_idx").on(table.userId, table.createdAt),
}));

export const accountRecoveryRequests = mysqlTable("account_recovery_requests", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  contactType: mysqlEnum("contactType", ["email", "phone"]).notNull(),
  newContactHash: varchar("newContactHash", { length: 128 }).notNull(),
  newContactEncrypted: text("newContactEncrypted").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "initial_approved",
    "final_approved",
    "rejected",
    "cancelled",
    "completed",
  ]).default("pending").notNull(),
  evidence: json("evidence").$type<Record<string, unknown> | null>(),
  availableAt: timestamp("availableAt").notNull(),
  cancelTokenHash: varchar("cancelTokenHash", { length: 128 }).notNull(),
  rejectReason: varchar("rejectReason", { length: 255 }),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updatedAt").default(sql`CURRENT_TIMESTAMP`).notNull().$onUpdate(() => new Date()),
}, (table) => ({
  cancelTokenUnique: uniqueIndex("account_recovery_cancel_token_unique").on(table.cancelTokenHash),
  userStatusIdx: index("account_recovery_user_status_idx").on(table.userId, table.status, table.createdAt),
  availableIdx: index("account_recovery_available_idx").on(table.status, table.availableAt),
  userFk: foreignKey({
    name: "account_recovery_userId_users_id_fk",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("restrict"),
}));

export type AccountRecoveryRequest = typeof accountRecoveryRequests.$inferSelect;

export const accountRecoveryReviews = mysqlTable("account_recovery_reviews", {
  id: serial("id").primaryKey(),
  requestId: bigint("requestId", { mode: "number", unsigned: true }).notNull(),
  reviewerId: bigint("reviewerId", { mode: "number", unsigned: true }).notNull(),
  stage: mysqlEnum("stage", ["initial", "final"]).notNull(),
  decision: mysqlEnum("decision", ["approve", "reject"]).notNull(),
  reason: varchar("reason", { length: 255 }),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  stageUnique: uniqueIndex("account_recovery_review_stage_unique").on(table.requestId, table.stage),
  requestFk: foreignKey({
    name: "account_recovery_reviews_request_fk",
    columns: [table.requestId],
    foreignColumns: [accountRecoveryRequests.id],
  }).onDelete("cascade"),
  reviewerFk: foreignKey({
    name: "account_recovery_reviews_reviewer_fk",
    columns: [table.reviewerId],
    foreignColumns: [users.id],
  }).onDelete("restrict"),
}));

export const recoveryCompletionTokens = mysqlTable("recovery_completion_tokens", {
  id: serial("id").primaryKey(),
  requestId: bigint("requestId", { mode: "number", unsigned: true }).notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  requestUnique: uniqueIndex("recovery_completion_request_unique").on(table.requestId),
  tokenUnique: uniqueIndex("recovery_completion_token_unique").on(table.tokenHash),
  requestFk: foreignKey({
    name: "recovery_completion_request_fk",
    columns: [table.requestId],
    foreignColumns: [accountRecoveryRequests.id],
  }).onDelete("cascade"),
}));

export const notificationOutbox = mysqlTable("notification_outbox", {
  id: serial("id").primaryKey(),
  channel: mysqlEnum("channel", ["email", "sms"]).notNull(),
  destinationEncrypted: text("destinationEncrypted").notNull(),
  template: varchar("template", { length: 80 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  status: mysqlEnum("status", ["pending", "processing", "sent", "failed"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  availableAt: timestamp("availableAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lockedAt: timestamp("lockedAt"),
  lastError: varchar("lastError", { length: 500 }),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  pendingIdx: index("notification_outbox_pending_idx").on(table.status, table.availableAt),
}));

export const integrityOrphanArchive = mysqlTable("integrity_orphan_archive", {
  id: serial("id").primaryKey(),
  sourceTable: varchar("sourceTable", { length: 64 }).notNull(),
  sourceId: varchar("sourceId", { length: 64 }).notNull(),
  reason: varchar("reason", { length: 120 }).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  archivedAt: timestamp("archivedAt").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  sourceUnique: uniqueIndex("integrity_orphan_source_unique").on(table.sourceTable, table.sourceId),
}));

export type IntegrityOrphanArchive = typeof integrityOrphanArchive.$inferSelect;

export const posts = mysqlTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "restrict",
  }),
  category: mysqlEnum("category", ["cloud_types", "rainbow", "glory", "ice_halo", "mirage", "lightning", "sky_color"]).notNull(),
  region: varchar("region", { length: 50 }),
  hasLocation: boolean("hasLocation").default(false).notNull(),
  images: json("images").$type<string[] | null>(),
  coverImage: text("coverImage"),
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

export const activities = mysqlTable("activities", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  coverImage: text("coverImage"),
  activityYear: int("activityYear").notNull(),
  activityMonth: int("activityMonth").notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "restrict",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => ({
  archiveIdx: index("activities_archive_idx").on(table.activityYear, table.activityMonth, table.createdAt),
}));

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

export const postLikes = mysqlTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: bigint("postId", { mode: "number", unsigned: true }).notNull().references(() => posts.id, {
    onDelete: "cascade",
  }),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  postUserUnique: uniqueIndex("post_likes_post_user_unique").on(table.postId, table.userId),
}));

export type PostLike = typeof postLikes.$inferSelect;

export const comments = mysqlTable("comments", {
  id: serial("id").primaryKey(),
  postId: bigint("postId", { mode: "number", unsigned: true }).notNull().references(() => posts.id, {
    onDelete: "cascade",
  }),
  authorId: bigint("authorId", { mode: "number", unsigned: true }).notNull().references(() => users.id, {
    onDelete: "restrict",
  }),
  parentId: bigint("parentId", { mode: "number", unsigned: true }).references(
    (): AnyMySqlColumn => comments.id,
    { onDelete: "cascade" },
  ),
  replyToUserId: bigint("replyToUserId", { mode: "number", unsigned: true }).references(() => users.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("approved").notNull(),
  reviewedBy: bigint("reviewedBy", { mode: "number", unsigned: true }).references(() => users.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewedAt"),
  rejectReason: varchar("rejectReason", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
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
