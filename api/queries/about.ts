import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";

export async function findAboutUs() {
  const rows = await getDb()
    .select()
    .from(schema.aboutUs)
    .limit(1);
  return rows.at(0) || null;
}

export async function upsertAboutUs(data: { content?: string }) {
  const existing = await findAboutUs();
  if (existing) {
    await getDb()
      .update(schema.aboutUs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.aboutUs.id, existing.id));
    return findAboutUs();
  }

  await getDb()
    .insert(schema.aboutUs)
    .values({
      content: data.content || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  return findAboutUs();
}
