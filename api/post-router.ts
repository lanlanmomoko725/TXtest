import { z } from "zod";
import { createRouter, publicQuery, l99Query, adminQuery } from "./middleware";
import {
  findPosts,
  findPostById,
  findFeaturedPosts,
  searchPosts,
  createPost,
  updatePost,
  deletePost,
  setPostFeatured,
  incrementViewCount,
  reorderSkyGalleryPosts,
} from "./queries/posts";
import { createAuditLog } from "./lib/audit";
import { CATEGORY_LABEL_MAP, SKY_CATEGORY_IDS } from "@contracts/constants";

export const postRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        category: z.string().optional(),
        region: z.string().optional(),
        authorId: z.number().optional(),
        featured: z.boolean().optional(),
        isArticle: z.boolean().optional(),
        isSkyExplanation: z.boolean().optional(),
        tag: z.string().optional(),
        skyGalleryCategory: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      return findPosts(input || {});
    }),

  byTag: publicQuery
    .input(
      z.object({
        tag: z.string().min(1),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      return findPosts({ tag: input.tag, limit: input.limit, offset: input.offset });
    }),

  featured: publicQuery
    .input(z.object({ limit: z.number().min(1).max(20).default(6) }).optional())
    .query(async ({ input }) => {
      return findFeaturedPosts(input?.limit || 6);
    }),

  byId: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const post = await findPostById(input.id);
      if (post) {
        await incrementViewCount(input.id);
      }
      return post;
    }),

  search: publicQuery
    .input(
      z.object({
        keyword: z.string().min(1).max(100),
        sort: z.enum(["relevance", "time", "hot"]).default("relevance"),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      return searchPosts(input);
    }),

  create: l99Query
    .input(
      z.object({
        title: z.string().max(255),
        content: z.string().min(1),
        category: z.enum(SKY_CATEGORY_IDS),
        region: z.string().optional(),
        hasLocation: z.boolean().default(false),
        images: z.array(z.string()).optional(),
        isArticle: z.boolean().default(false),
        skyGalleryCategory: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const skyGalleryCategory =
        (ctx.user.role === "admin" || ctx.user.role === "super_admin") && input.skyGalleryCategory
          ? CATEGORY_LABEL_MAP[input.category]
          : undefined;
      return createPost({
        ...input,
        skyGalleryCategory,
        authorId: ctx.user.id,
      });
    }),

  update: l99Query
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).optional(),
        category: z.enum(SKY_CATEGORY_IDS).optional(),
        region: z.string().optional(),
        hasLocation: z.boolean().optional(),
        images: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const post = await findPostById(input.id);
      if (!post) throw new Error("Post not found");
      if (post.authorId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
        throw new Error("Not authorized");
      }
      const { id, ...data } = input;
      return updatePost(id, data);
    }),

  delete: l99Query
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const post = await findPostById(input.id);
      if (!post) throw new Error("Post not found");
      if (post.authorId !== ctx.user.id && ctx.user.role !== "admin" && ctx.user.role !== "super_admin") {
        throw new Error("Not authorized");
      }
      await deletePost(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "delete_post",
        targetType: "post",
        targetId: input.id,
        details: { title: post.title },
      });
      return { success: true };
    }),

  setFeatured: adminQuery
    .input(
      z.object({
        id: z.number(),
        featured: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await setPostFeatured(input.id, input.featured);
      await createAuditLog({
        userId: ctx.user.id,
        action: input.featured ? "feature_post" : "unfeature_post",
        targetType: "post",
        targetId: input.id,
      });
      return { success: true };
    }),

  reorderSkyGallery: adminQuery
    .input(
      z.object({
        orderedIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await reorderSkyGalleryPosts(input.orderedIds);
      await createAuditLog({
        userId: ctx.user.id,
        action: "reorder_sky_gallery",
        targetType: "gallery",
        details: { orderedIds: input.orderedIds },
      });
      return { success: true };
    }),
});
