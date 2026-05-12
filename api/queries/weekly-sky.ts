import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

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
  const existing = await findWeeklySky();
  if (existing) {
    await getDb()
      .update(schema.weeklySkies)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.weeklySkies.id, existing.id));
    return findWeeklySky();
  }

  await getDb()
    .insert(schema.weeklySkies)
    .values({
      image: data.image || null,
      title: data.title || null,
      content: data.content || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return findWeeklySky();
}
