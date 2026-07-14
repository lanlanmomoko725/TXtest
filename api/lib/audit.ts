import { getDb } from "../queries/connection";
import * as schema from "@db/schema";
import { eq } from "drizzle-orm";

type AuditParams = {
  userId: number;
  action: string;
  targetType: string;
  targetId?: string | number;
  details?: Record<string, unknown>;
};

export async function createAuditLog(params: AuditParams) {
  const [actor] = await getDb().select({
    publicId: schema.users.publicId,
    role: schema.users.role,
    name: schema.users.name,
  }).from(schema.users).where(eq(schema.users.id, params.userId)).limit(1);
  await getDb().insert(schema.auditLogs).values({
    userId: params.userId,
    actorPublicId: actor?.publicId ?? null,
    actorRole: actor?.role ?? null,
    actorName: actor?.name ?? null,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId != null ? String(params.targetId) : null,
    details: params.details ?? null,
    createdAt: new Date(),
  });
}
