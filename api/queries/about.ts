import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import { sanitizeHtml } from "@contracts/html-sanitizer";
import { assertUsableUploadPaths, extractUploadPathsFromHtml } from "../lib/upload-ownership";

export async function findAboutUs() {
  const rows = await getDb()
    .select()
    .from(schema.aboutUs)
    .limit(1);
  const about = rows.at(0);
  return about ? { ...about, content: sanitizeHtml(about.content) || null } : null;
}

export async function upsertAboutUs(data: { content?: string }, actorUserId: number) {
  const content = data.content === undefined ? undefined : sanitizeHtml(data.content);
  const existing = await findAboutUs();
  if (content !== undefined) {
    await assertUsableUploadPaths({
      paths: extractUploadPathsFromHtml(content),
      userId: actorUserId,
      purpose: "content",
      legacyPaths: extractUploadPathsFromHtml(existing?.content),
    });
  }
  if (existing) {
    await getDb()
      .update(schema.aboutUs)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(schema.aboutUs.id, existing.id));
    return findAboutUs();
  }

  await getDb()
    .insert(schema.aboutUs)
    .values({
      content: content || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return findAboutUs();
}
