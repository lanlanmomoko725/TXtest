import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import { isSafeUploadPath } from "@contracts/upload-path";

export async function findWeeklySky() {
  const rows = await getDb()
    .select()
    .from(schema.weeklySkies)
    .limit(1);
  return rows.at(0) || null;
}

export async function upsertWeeklySky(data: {
  image?: string;
  title?: string;
  content?: string;
}) {
  const safeData = {
    ...data,
    image: data.image === undefined ? undefined : isSafeUploadPath(data.image) ? data.image : null,
  };
  const existing = await findWeeklySky();
  if (existing) {
    await getDb()
      .update(schema.weeklySkies)
      .set({
        ...safeData,
        updatedAt: new Date(),
      })
      .where(eq(schema.weeklySkies.id, existing.id));
    return findWeeklySky();
  }

  await getDb()
    .insert(schema.weeklySkies)
    .values({
      image: safeData.image || null,
      title: safeData.title || null,
      content: safeData.content || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return findWeeklySky();
}
