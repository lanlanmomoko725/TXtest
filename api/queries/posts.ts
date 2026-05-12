import { eq, desc, and, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertPost } from "@db/schema";
import { getDb } from "./connection";

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
  if (Array.isArray(images)) return images.filter((i) => typeof i === "string" && i.length > 0);
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) return parsed.filter((i: unknown) => typeof i === "string" && i.length > 0);
    } catch {
      return null;
    }
  }
  return null;
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
  limit?: number;
  offset?: number;
}) {
  const { category, region, authorId, featured, isArticle, isSkyExplanation, tag, skyGalleryCategory, limit = 20, offset = 0 } = options;

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
  const orderByClause = skyGalleryCategory !== undefined
    ? [schema.posts.sortOrder, desc(schema.posts.createdAt)]
    : [desc(schema.posts.createdAt)];

  const posts = await getDb()
    .select()
    .from(schema.posts)
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(limit)
    .offset(offset);

  // Get authors
  const authorIds = [...new Set(posts.map((p) => p.authorId))];
  const allAuthors = [];
  for (const id of authorIds) {
    const user = await getDb().query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    if (user) allAuthors.push(user);
  }

  const authorMap = new Map(allAuthors.map((a) => [a.id, a]));

  return posts.map((post) => {
    // Ensure images is always a proper array; fallback to extracting from content
    let images = normalizeImages(post.images);
    if (!images || images.length === 0) {
      images = extractImagesFromHtml(post.content);
    }
    return {
      ...post,
      images: images.length > 0 ? images : null,
      author: authorMap.get(post.authorId) || null,
    };
  });
}

export async function findPostById(id: number) {
  const post = await getDb().query.posts.findFirst({
    where: eq(schema.posts.id, id),
    with: { author: true },
  });
  if (!post) return null;
  // Ensure images is always a proper array; fallback to extracting from content
  let images = normalizeImages(post.images);
  if (!images || images.length === 0) {
    images = extractImagesFromHtml(post.content);
  }
  return { ...post, images: images.length > 0 ? images : null };
}

export async function findFeaturedPosts(limit = 6) {
  return findPosts({ featured: true, limit });
}

// Extract plain text from HTML content (for auto-title generation)
function extractPlainTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function createPost(data: {
  title: string;
  content: string;
  authorId: number;
  category: string;
  region?: string;
  hasLocation: boolean;
  images?: string[];
  isArticle: boolean;
  skyGalleryCategory?: string;
}) {
  // For non-article posts, merge uploaded images with content images
  // For articles, images are embedded inline in content — don't duplicate in images field
  const contentImages = data.isArticle ? [] : extractImagesFromHtml(data.content);
  const mergedImages = data.images && data.images.length > 0
    ? [...data.images, ...contentImages.filter((url) => !data.images!.includes(url))]
    : contentImages.length > 0 ? contentImages : null;

  // Extract tags from content and auto-detect sky explanation
  const tags = extractTagsFromHtml(data.content);
  const isSkyExplanation = tags.includes("天象解说图");

  // Auto-generate title from content if empty
  let title = data.title.trim();
  if (!title) {
    const plainText = extractPlainTextFromHtml(data.content);
    title = plainText.slice(0, 30) + (plainText.length > 30 ? "..." : "");
  }

  const insertData: InsertPost = {
    title,
    content: data.content,
    authorId: data.authorId,
    category: data.category as InsertPost["category"],
    region: data.region || null,
    hasLocation: data.hasLocation,
    images: mergedImages,
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
    isArticle: boolean;
    skyGalleryCategory?: string;
  }>
) {
  const updateData: Partial<InsertPost> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) {
    updateData.content = data.content;
    // For articles, images are inline — don't extract to avoid duplication
    const contentImages = data.isArticle ? [] : extractImagesFromHtml(data.content);
    const existingImages = data.images || [];
    const mergedImages = existingImages.length > 0
      ? [...existingImages, ...contentImages.filter((url) => !existingImages.includes(url))]
      : contentImages.length > 0 ? contentImages : null;
    updateData.images = mergedImages;

    // Re-extract tags and auto-detect sky explanation
    const tags = extractTagsFromHtml(data.content);
    updateData.tags = tags.length > 0 ? tags : null;
    updateData.isSkyExplanation = tags.includes("天象解说图");
  } else if (data.images !== undefined) {
    updateData.images = data.images;
  }
  if (data.category !== undefined) updateData.category = data.category as InsertPost["category"];
  if (data.region !== undefined) updateData.region = data.region;
  if (data.hasLocation !== undefined) updateData.hasLocation = data.hasLocation;
  if (data.isArticle !== undefined) updateData.isArticle = data.isArticle;
  if (data.skyGalleryCategory !== undefined) updateData.skyGalleryCategory = data.skyGalleryCategory || null;

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

export async function reorderSkyGalleryPosts(orderedIds: number[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await getDb()
      .update(schema.posts)
      .set({ sortOrder: i })
      .where(eq(schema.posts.id, orderedIds[i]));
  }
}
