import { and, asc, eq, inArray, lte } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { decryptIdentity, encryptIdentity } from "./identity";
import { env } from "./env";
import { sendSecurityEmail, sendVerificationEmail } from "./mail";
import { verificationSubject, verificationTemplateLabel } from "./verification-code";
import type { VerificationPurpose } from "./verification-code";

const OUTBOX_INTERVAL_MS = 60_000;
let outboxTimer: ReturnType<typeof setInterval> | null = null;

type NotificationTemplate = "contact_changed" | "recovery_alert" | "recovery_complete" | "verification_code";

function renderNotification(template: NotificationTemplate, payload: Record<string, unknown>) {
  if (template === "verification_code") throw new Error("Verification codes use a dedicated email renderer");
  if (template === "contact_changed") {
    return {
      subject: "天象志账号联系方式已变更",
      text: `你的天象志账号${String(payload.contactLabel ?? "联系方式")}已完成变更。如果不是你本人操作，请立即联系管理员。`,
    };
  }
  if (template === "recovery_alert") {
    return {
      subject: "天象志账号恢复申请提醒",
      text: `你的账号正在申请恢复。申请将在审核和冷静期结束后处理。如果不是你本人操作，请访问以下地址取消：\n${String(payload.cancelUrl ?? "")}`,
    };
  }
  return {
    subject: "完成天象志账号恢复",
    text: `账号恢复审核已通过。请在 24 小时内访问以下地址设置新密码并完成恢复：\n${String(payload.completeUrl ?? "")}`,
  };
}

async function sendSmsNotification(destination: string, template: string, payload: Record<string, unknown>) {
  if (!env.smsNoticeWebhookUrl) throw new Error("SMS notice webhook is not configured");
  const response = await fetch(env.smsNoticeWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.smsNoticeWebhookSecret ? { authorization: `Bearer ${env.smsNoticeWebhookSecret}` } : {}),
    },
    body: JSON.stringify({ phone: destination, template, payload }),
  });
  if (!response.ok) throw new Error(`SMS notice webhook returned ${response.status}`);
}

export async function enqueueSecurityNotification(params: {
  channel: "email" | "sms";
  destination: string;
  template: NotificationTemplate;
  payload?: Record<string, unknown>;
}) {
  await getDb().insert(schema.notificationOutbox).values({
    channel: params.channel,
    destinationEncrypted: encryptIdentity(params.destination),
    template: params.template,
    payload: params.payload ?? {},
    status: "pending",
    attempts: 0,
    availableAt: new Date(),
    createdAt: new Date(),
  });
  void processNotificationOutbox().catch((error) => console.error("[notifications] immediate delivery failed", error));
}

export async function enqueueVerificationEmail(params: {
  email: string;
  code: string;
  purpose: VerificationPurpose;
}) {
  await getDb().insert(schema.notificationOutbox).values({
    channel: "email",
    destinationEncrypted: encryptIdentity(params.email),
    template: "verification_code",
    payload: {
      purpose: params.purpose,
      codeEncrypted: encryptIdentity(params.code),
    },
    status: "pending",
    attempts: 0,
    availableAt: new Date(),
    createdAt: new Date(),
  });
  void processNotificationOutbox().catch((error) => console.error("[notifications] immediate delivery failed", error));
}

export async function processNotificationOutbox() {
  const now = new Date();
  await getDb()
    .update(schema.notificationOutbox)
    .set({ status: "failed", lockedAt: null, availableAt: now, lastError: "stale processing claim recovered" })
    .where(
      and(
        eq(schema.notificationOutbox.status, "processing"),
        lte(schema.notificationOutbox.lockedAt, new Date(now.getTime() - 10 * 60_000)),
      ),
    );
  const rows = await getDb()
    .select()
    .from(schema.notificationOutbox)
    .where(
      and(
        inArray(schema.notificationOutbox.status, ["pending", "failed"]),
        lte(schema.notificationOutbox.availableAt, now),
      ),
    )
    .orderBy(asc(schema.notificationOutbox.createdAt))
    .limit(20);

  for (const row of rows) {
    const claim = await getDb()
      .update(schema.notificationOutbox)
      .set({ status: "processing", lockedAt: now })
      .where(
        and(
          eq(schema.notificationOutbox.id, row.id),
          inArray(schema.notificationOutbox.status, ["pending", "failed"]),
        ),
      );
    const header = Array.isArray(claim) ? claim[0] : claim;
    const affectedRows = header && typeof header === "object" && "affectedRows" in header
      ? Number((header as { affectedRows: unknown }).affectedRows)
      : 0;
    if (affectedRows !== 1) continue;

    try {
      const destination = decryptIdentity(row.destinationEncrypted);
      if (!destination) throw new Error("Notification destination cannot be decrypted");
      const payload = row.payload ?? {};
      if (row.channel === "email") {
        if (row.template === "verification_code") {
          const purpose = String(payload.purpose ?? "") as VerificationPurpose;
          const code = decryptIdentity(String(payload.codeEncrypted ?? ""));
          if (!code) throw new Error("Verification code cannot be decrypted");
          await sendVerificationEmail(destination, code, {
            subject: verificationSubject(purpose),
            label: verificationTemplateLabel(purpose),
          });
        } else {
          const rendered = renderNotification(row.template as NotificationTemplate, payload);
          await sendSecurityEmail(destination, rendered.subject, rendered.text);
        }
      } else {
        await sendSmsNotification(destination, row.template, payload);
      }
      await getDb()
        .update(schema.notificationOutbox)
        .set({ status: "sent", sentAt: new Date(), attempts: row.attempts + 1, lastError: null, lockedAt: null })
        .where(eq(schema.notificationOutbox.id, row.id));
    } catch (error) {
      const attempts = row.attempts + 1;
      await getDb()
        .update(schema.notificationOutbox)
        .set({
          status: "failed",
          lockedAt: null,
          attempts,
          lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
          availableAt: new Date(Date.now() + Math.min(24 * 60, 2 ** Math.min(attempts, 10)) * 60_000),
        })
        .where(eq(schema.notificationOutbox.id, row.id));
    }
  }
}

export function startNotificationOutboxWorker() {
  if (outboxTimer) return outboxTimer;
  void processNotificationOutbox().catch((error) => console.error("[notifications] startup delivery failed", error));
  outboxTimer = setInterval(() => {
    void processNotificationOutbox().catch((error) => console.error("[notifications] delivery failed", error));
  }, OUTBOX_INTERVAL_MS);
  outboxTimer.unref();
  return outboxTimer;
}
