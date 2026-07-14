import { eq, desc, and, sql, count, gte, inArray } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertPost } from "@db/schema";
import { getDb } from "./connection";
import { findPublicUsersByIds } from "./users";
import { sanitizeHtml } from "@contracts/html-sanitizer";
import { filterSafeUploadPaths } from "@contracts/upload-path";
import { assertUsableUploadPaths } from "../lib/upload-ownership";

// Extract image URLs from HTML content (for article mode images)
function extractImagesFromHtml(html: string): string[] {
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

// Extract tags from HTML content: #tag# format
function extractTagsFromHtml(html: string): string[] {
  // Remove HTML tags first to avoid matching inside attributes
  const textOnly = html.replace(/<[^>]+>/g, " ");
  const regex = /#([^#\s]+)#/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(textOnly)) !== null) {
    if (match[1].length > 0) matches.push(match[1]);
  }
  return [...new Set(matches)];
}

// Normalize images field to ensure it's always an array or null
function normalizeImages(images: unknown): string[] | null {
  if (Array.isArray(images)) return filterSafeUploadPaths(images);
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) return filterSafeUploadPaths(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeCoverImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return filterSafeUploadPaths([value])?.[0] ?? null;
}

function uniqueImages(...groups: Array<string[] | null | undefined>): string[] {
  return [...new Set(groups.flatMap((group) => group ?? []))];
}

function getPostImageCandidates(content: string, images: unknown): string[] {
  return uniqueImages(
    normalizeImages(images),
    filterSafeUploadPaths(extractImagesFromHtml(content)),
  );
}

function resolveCoverImage(input: unknown, candidates: string[], fallback: unknown = null, strict = true): string | null {
  const hasInput = typeof input === "string" && input.trim().length > 0;
  const selected = normalizeCoverImage(input);
  if (hasInput && !selected && strict) {
    throw new Error("Cover image must be a valid uploaded image path");
  }
  if (selected) {
    if (!candidates.includes(selected)) {
      if (!strict) return candidates[0] ?? null;
      throw new Error("Cover image must be selected from this post's uploaded images");
    }
    return selected;
  }

  const existing = normalizeCoverImage(fallback);
  if (existing && candidates.includes(existing)) return existing;
  return candidates[0] ?? null;
}

function isLikablePost(post: typeof schema.posts.$inferSelect) {
  return !post.skyGalleryCategory;
}

export function shanghaiWeekStart(now = new Date()) {
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = local.getUTCDay();
  const diff = (day + 6) % 7;
  local.setUTCDate(local.getUTCDate() - diff);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 8 * 60 * 60 * 1000);
}

async function attachPostMeta<T extends typeof schema.posts.$inferSelect>(
  posts: T[],
  currentUserId?: number,
) {
  const authorMap = await findPublicUsersByIds(posts.map((p) => p.authorId));
  const ids = posts.map((post) => post.id);
  const weekStart = shanghaiWeekStart();
  const weeklyLikeMap = new Map<number, number>();
  const likedByMe = new Set<number>();

  if (ids.length > 0) {
    const likeRows = await getDb()
      .select({
        postId: schema.postLikes.postId,
        value: count(),
      })
      .from(schema.postLikes)
      .where(and(inArray(schema.postLikes.postId, ids), gte(schema.postLikes.createdAt, weekStart)))
      .groupBy(schema.postLikes.postId);
    for (const row of likeRows) {
      weeklyLikeMap.set(row.postId, Number(row.value));
    }

    if (currentUserId) {
      const myLikes = await getDb()
        .select({ postId: schema.postLikes.postId })
        .from(schema.postLikes)
        .where(and(inArray(schema.postLikes.postId, ids), eq(schema.postLikes.userId, currentUserId)));
      for (const row of myLikes) {
        likedByMe.add(row.postId);
      }
    }
  }

  return posts.map((post) => {
    const content = sanitizeHtml(post.content);
    const images = getPostImageCandidates(content, post.images);
    const coverImage = resolveCoverImage(post.coverImage, images, null, false);
    const weeklyLikeCount = weeklyLikeMap.get(post.id) ?? 0;
    return {
      ...post,
      content,
      images: images.length > 0 ? images : null,
      coverImage,
      author: authorMap.get(post.authorId) || null,
      weeklyLikeCount,
      likeCount: weeklyLikeCount,
      likedByMe: likedByMe.has(post.id),
    };
  });
}

export async function findPosts(options: {
  category?: string;
  region?: string;
  authorId?: number;
  featured?: boolean;
  isArticle?: boolean;
  isSkyExplanation?: boolean;
  tag?: string;
  skyGalleryCategory?: string;
  sort?: "time" | "hot";
  currentUserId?: number;
  limit?: number;
  offset?: number;
}) {
  const { category, region, authorId, featured, isArticle, isSkyExplanation, tag, skyGalleryCategory, sort = "time", currentUserId, limit = 20, offset = 0 } = options;

  const conditions = [];
  if (category) conditions.push(sql`${schema.posts.category} = ${category}`);
  if (region) conditions.push(eq(schema.posts.region, region));
  if (authorId) conditions.push(eq(schema.posts.authorId, authorId));
  if (featured !== undefined) conditions.push(eq(schema.posts.isFeatured, featured));
  if (isArticle !== undefined) conditions.push(eq(schema.posts.isArticle, isArticle));
  if (isSkyExplanation !== undefined) conditions.push(eq(schema.posts.isSkyExplanation, isSkyExplanation));
  if (tag) {
    // MySQL JSON_CONTAINS: check if tags JSON array contains the tag string
    conditions.push(sql`JSON_CONTAINS(${schema.posts.tags}, JSON_QUOTE(${tag}))`);
  }
  if (skyGalleryCategory !== undefined) {
    if (skyGalleryCategory === "") {
      // Empty string = all sky gallery posts (skyGalleryCategory IS NOT NULL)
      conditions.push(sql`${schema.posts.skyGalleryCategory} IS NOT NULL`);
    } else {
      conditions.push(eq(schema.posts.skyGalleryCategory, skyGalleryCategory));
    }
  } else {
    // Exclude sky gallery posts from regular category/region queries
    conditions.push(sql`${schema.posts.skyGalleryCategory} IS NULL`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // When filtering by sky gallery, sort by sortOrder first
  const weeklyLikeScore = sql<number>`(
    SELECT COUNT(*)
    FROM ${schema.postLikes}
    WHERE ${schema.postLikes.postId} = ${schema.posts.id}
      AND ${schema.postLikes.createdAt} >= ${shanghaiWeekStart()}
  )`;
  const orderByClause = skyGalleryCategory !== undefined
    ? [schema.posts.sortOrder, desc(schema.posts.createdAt)]
    : sort === "hot"
      ? [desc(weeklyLikeScore), desc(schema.posts.createdAt)]
      : [desc(schema.posts.createdAt)];

  const posts = await getDb()
    .select()
    .from(schema.posts)
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(limit)
    .offset(offset);

  return attachPostMeta(posts, currentUserId);
}

export async function findPostById(id: number, currentUserId?: number) {
  const post = await getDb().query.posts.findFirst({
    where: eq(schema.posts.id, id),
  });
  if (!post) return null;
  const [withMeta] = await attachPostMeta([post], currentUserId);
  return withMeta;
}

export async function findFeaturedPosts(limit = 6, currentUserId?: number) {
  return findPosts({ featured: true, limit, currentUserId });
}

export async function createPost(data: {
  title: string;
  content: string;
  authorId: number;
  category: string;
  region?: string;
  hasLocation: boolean;
  images?: string[];
  coverImage?: string;
  isArticle: boolean;
  skyGalleryCategory?: string;
}) {
  // For non-article posts, merge uploaded images with content images
  // For articles, images are embedded inline in content — don't duplicate in images field
  const content = sanitizeHtml(data.content);
  const safeContentImages = filterSafeUploadPaths(extractImagesFromHtml(content)) ?? [];
  const contentImages = data.isArticle ? [] : safeContentImages;
  const safeInputImages = filterSafeUploadPaths(data.images) ?? [];
  const mergedImages = safeInputImages.length > 0
    ? [...safeInputImages, ...contentImages.filter((url) => !safeInputImages.includes(url))]
    : contentImages.length > 0 ? contentImages : null;
  const coverCandidates = data.isArticle ? safeContentImages : (mergedImages ?? []);
  const coverImage = resolveCoverImage(data.coverImage, coverCandidates);
  await assertUsableUploadPaths({
    paths: coverCandidates,
    userId: data.authorId,
    purpose: "content",
  });

  // Extract tags from content and auto-detect sky explanation
  const tags = extractTagsFromHtml(content);
  const isSkyExplanation = tags.includes("天象解说图");

  const title = data.title.trim();

  const insertData: InsertPost = {
    title,
    content,
    authorId: data.authorId,
    category: data.category as InsertPost["category"],
    region: data.region || null,
    hasLocation: data.hasLocation,
    images: mergedImages,
    coverImage,
    isArticle: data.isArticle,
    isSkyExplanation,
    skyGalleryCategory: data.skyGalleryCategory || null,
    tags: tags.length > 0 ? tags : null,
  };

  const [{ id }] = await getDb().insert(schema.posts).values(insertData).$returningId();

  return findPostById(id);
}

export async function updatePost(
  id: number,
  data: Partial<{
    title: string;
    content: string;
    category: string;
    region: string;
    hasLocation: boolean;
    images: string[];
    coverImage: string;
    isArticle: boolean;
    skyGalleryCategory?: string;
  }>,
  actorUserId: number,
) {
  const existingPost = await getDb().query.posts.findFirst({
    where: eq(schema.posts.id, id),
  });
  if (!existingPost) throw new Error("Post not found");

  const updateData: Partial<InsertPost> = {};
  let nextContent = sanitizeHtml(existingPost.content);
  let nextImages: string[] | null = normalizeImages(existingPost.images);
  const legacyPaths = getPostImageCandidates(nextContent, nextImages);
  const nextIsArticle = data.isArticle ?? existingPost.isArticle;
  if (data.content !== undefined) {
    const content = sanitizeHtml(data.content);
    nextContent = content;
    updateData.content = content;
    // For articles, images are inline — don't extract to avoid duplication
    const safeContentImages = filterSafeUploadPaths(extractImagesFromHtml(content)) ?? [];
    const contentImages = nextIsArticle ? [] : safeContentImages;
    const existingImages = filterSafeUploadPaths(data.images) ?? [];
    const mergedImages = existingImages.length > 0
      ? [...existingImages, ...contentImages.filter((url) => !existingImages.includes(url))]
      : contentImages.length > 0 ? contentImages : null;
    updateData.images = mergedImages;
    nextImages = mergedImages;

    // Re-extract tags and auto-detect sky explanation
    const tags = extractTagsFromHtml(content);
    updateData.tags = tags.length > 0 ? tags : null;
    updateData.isSkyExplanation = tags.includes("天象解说图");
  } else if (data.images !== undefined) {
    nextImages = filterSafeUploadPaths(data.images);
    updateData.images = nextImages;
  }
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.category !== undefined) updateData.category = data.category as InsertPost["category"];
  if (data.region !== undefined) updateData.region = data.region;
  if (data.hasLocation !== undefined) updateData.hasLocation = data.hasLocation;
  if (data.isArticle !== undefined) updateData.isArticle = data.isArticle;
  if (data.skyGalleryCategory !== undefined) updateData.skyGalleryCategory = data.skyGalleryCategory || null;
  if (data.coverImage !== undefined || data.content !== undefined || data.images !== undefined || data.isArticle !== undefined) {
    const nextCandidates = getPostImageCandidates(nextContent, nextImages);
    await assertUsableUploadPaths({
      paths: nextCandidates,
      userId: actorUserId,
      purpose: "content",
      legacyPaths,
    });
    updateData.coverImage = resolveCoverImage(
      data.coverImage,
      nextCandidates,
      existingPost.coverImage,
    );
  }

  await getDb().update(schema.posts).set(updateData).where(eq(schema.posts.id, id));
  return findPostById(id);
}

export async function deletePost(id: number) {
  await getDb().delete(schema.posts).where(eq(schema.posts.id, id));
}

export async function setPostFeatured(id: number, featured: boolean) {
  await getDb()
    .update(schema.posts)
    .set({ isFeatured: featured })
    .where(eq(schema.posts.id, id));
  return findPostById(id);
}

export async function incrementViewCount(id: number) {
  await getDb()
    .update(schema.posts)
    .set({ viewCount: sql`${schema.posts.viewCount} + 1` })
    .where(eq(schema.posts.id, id));
}

function isDuplicateEntryError(error: unknown) {
  let current: unknown = error;
  for (let i = 0; i < 3; i++) {
    if (!current || typeof current !== "object") return false;
    const value = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (value.code === "ER_DUP_ENTRY" || value.errno === 1062) return true;
    current = value.cause;
  }
  return false;
}

export async function togglePostLike(postId: number, userId: number) {
  const post = await getDb().query.posts.findFirst({
    where: eq(schema.posts.id, postId),
  });
  if (!post || !isLikablePost(post)) {
    throw new Error("帖子不存在或不支持点赞。");
  }

  const [existing] = await getDb()
    .select()
    .from(schema.postLikes)
    .where(and(eq(schema.postLikes.postId, postId), eq(schema.postLikes.userId, userId)))
    .limit(1);

  if (existing) {
    return { liked: true };
  }

  try {
    await getDb().insert(schema.postLikes).values({
      postId,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    if (!isDuplicateEntryError(error)) {
      throw error;
    }
  }
  return { liked: true };
}

export async function searchPosts(options: {
  keyword: string;
  sort?: "relevance" | "time" | "hot";
  currentUserId?: number;
  limit?: number;
  offset?: number;
}) {
  const { keyword, sort = "relevance", currentUserId, limit = 20, offset = 0 } = options;
  const db = getDb();
  const likePattern = `%${keyword}%`;

  // Search condition: match title OR content OR tags
  const searchCondition = sql`(
    ${schema.posts.title} LIKE ${likePattern} OR
    ${schema.posts.content} LIKE ${likePattern} OR
    ${schema.posts.tags} LIKE ${likePattern}
  )`;

  // Build order by based on sort type
  let orderByClause;
  if (sort === "relevance") {
    // Relevance score: title match = 3, content match = 1, tags match = 2
    const relevanceScore = sql`(
      CASE WHEN ${schema.posts.title} LIKE ${likePattern} THEN 3 ELSE 0 END +
      CASE WHEN ${schema.posts.content} LIKE ${likePattern} THEN 1 ELSE 0 END +
      CASE WHEN ${schema.posts.tags} LIKE ${likePattern} THEN 2 ELSE 0 END
    )`;
    orderByClause = [desc(relevanceScore), desc(schema.posts.createdAt)];
  } else if (sort === "hot") {
    const weeklyLikeScore = sql<number>`(
      SELECT COUNT(*)
      FROM ${schema.postLikes}
      WHERE ${schema.postLikes.postId} = ${schema.posts.id}
        AND ${schema.postLikes.createdAt} >= ${shanghaiWeekStart()}
    )`;
    orderByClause = [desc(weeklyLikeScore), desc(schema.posts.createdAt)];
  } else {
    // time
    orderByClause = [desc(schema.posts.createdAt)];
  }

  // Get total count
  const totalResult = await db
    .select({ value: count() })
    .from(schema.posts)
    .where(searchCondition);
  const total = totalResult[0]?.value ?? 0;

  // Get posts
  const posts = await db
    .select()
    .from(schema.posts)
    .where(searchCondition)
    .orderBy(...orderByClause)
    .limit(limit)
    .offset(offset);

  return {
    posts: await attachPostMeta(posts, currentUserId),
    total,
  };
}

export async function reorderSkyGalleryPosts(orderedIds: number[]) {
  await getDb().transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.posts)
        .set({ sortOrder: i })
        .where(eq(schema.posts.id, orderedIds[i]));
    }
  });
}
