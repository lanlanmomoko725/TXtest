import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

type AuditParams = {
  userId: number;
  action: string;
  targetType: string;
  targetId?: string | number;
  details?: Record<string, unknown>;
};

export async function createAuditLog(params: AuditParams) {
  await getDb().insert(schema.auditLogs).values({
    userId: params.userId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId != null ? String(params.targetId) : null,
    details: params.details ?? null,
    createdAt: new Date(),
  });
}
