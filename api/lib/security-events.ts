import { getDb } from "../queries/connection";
import * as schema from "@db/schema";

export async function recordSecurityEvent(params: {
  event: string;
  subject?: string;
  userId?: number;
  ip?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await getDb().insert(schema.securityEvents).values({
      event: params.event.slice(0, 80),
      subject: params.subject ? params.subject.slice(0, 255) : null,
      userId: params.userId ?? null,
      ip: params.ip ?? null,
      details: params.details ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[security-event] failed to record", err);
  }
}
