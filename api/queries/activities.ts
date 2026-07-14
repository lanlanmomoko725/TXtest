import { and, count, desc, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertActivity } from "@db/schema";
import { sanitizeHtml } from "@contracts/html-sanitizer";
import { filterSafeUploadPaths } from "@contracts/upload-path";
import { getDb } from "./connection";
import { assertUsableUploadPaths } from "../lib/upload-ownership";

function extractImagesFromHtml(html: string): string[] {
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function activityImages(content: string): string[] {
  return filterSafeUploadPaths(extractImagesFromHtml(content)) ?? [];
}

function normalizeCoverImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return filterSafeUploadPaths([value])?.[0] ?? null;
}

function resolveCoverImage(input: unknown, candidates: string[]): string | null {
  const hasInput = typeof input === "string" && input.trim().length > 0;
  const selected = normalizeCoverImage(input);
  if (hasInput && !selected) {
    throw new Error("Cover image must be a valid uploaded image path");
  }
  if (selected && !candidates.includes(selected)) {
    throw new Error("Cover image must be selected from this activity's content images");
  }
  return selected ?? candidates[0] ?? null;
}

function normalizeActivity<T extends typeof schema.activities.$inferSelect>(activity: T) {
  const content = sanitizeHtml(activity.content);
  const images = activityImages(content);
  const storedCover = normalizeCoverImage(activity.coverImage);
  const coverImage = storedCover && images.includes(storedCover) ? storedCover : images[0] ?? null;
  return {
    ...activity,
    content,
    coverImage,
  };
}

export async function findActivities(options: {
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
} = {}) {
  const { year, month, limit = 50, offset = 0 } = options;
  const conditions = [];
  if (year !== undefined) conditions.push(eq(schema.activities.activityYear, year));
  if (month !== undefined) conditions.push(eq(schema.activities.activityMonth, month));

  const rows = await getDb()
    .select()
    .from(schema.activities)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.activities.activityYear), desc(schema.activities.activityMonth), desc(schema.activities.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map(normalizeActivity);
}

export async function findActivityById(id: number) {
  const row = await getDb().query.activities.findFirst({
    where: eq(schema.activities.id, id),
  });
  return row ? normalizeActivity(row) : null;
}

export async function findActivityArchive() {
  const rows = await getDb()
    .select({
      year: schema.activities.activityYear,
      month: schema.activities.activityMonth,
      count: count(),
    })
    .from(schema.activities)
    .groupBy(schema.activities.activityYear, schema.activities.activityMonth)
    .orderBy(desc(schema.activities.activityYear), desc(schema.activities.activityMonth));

  return rows.map((row) => ({
    year: row.year,
    month: row.month,
    count: Number(row.count),
  }));
}

export async function createActivity(data: {
  title: string;
  content: string;
  coverImage?: string;
  activityYear: number;
  activityMonth: number;
  createdBy: number;
}) {
  const content = sanitizeHtml(data.content);
  const images = activityImages(content);
  const coverImage = resolveCoverImage(data.coverImage, images);
  await assertUsableUploadPaths({
    paths: images,
    userId: data.createdBy,
    purpose: "content",
  });
  const insertData: InsertActivity = {
    title: data.title.trim(),
    content,
    coverImage,
    activityYear: data.activityYear,
    activityMonth: data.activityMonth,
    createdBy: data.createdBy,
  };

  const [{ id }] = await getDb().insert(schema.activities).values(insertData).$returningId();
  return findActivityById(id);
}

export async function deleteActivity(id: number) {
  const activity = await findActivityById(id);
  if (!activity) throw new Error("Activity not found");
  await getDb().delete(schema.activities).where(eq(schema.activities.id, id));
  return activity;
}
