import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { findCommentsByPost, createComment, deleteCommentThread, findCommentById } from "./queries/comments";
import { assertCommentAllowed } from "./lib/comment-filter";
import { createAuditLog } from "./lib/audit";
import { consumeRateLimit, rateLimitKey } from "./lib/rate-limit";
import { requestIp } from "./lib/request-info";
import { recordSecurityEvent } from "./lib/security-events";

const COMMENT_MAX_LENGTH = 300;

export const commentRouter = createRouter({
  list: publicQuery
    .input(z.object({ postId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return findCommentsByPost(input.postId);
    }),

  create: authedQuery
    .input(
      z.object({
        postId: z.number().int().positive(),
        content: z.string().trim().min(1, "评论不能为空。").max(COMMENT_MAX_LENGTH, "评论最多 300 个字符。"),
        replyToCommentId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const content = input.content.trim();
      const ip = requestIp(ctx.req.headers);
      if (!content) {
        throw new Error("评论不能为空。");
      }

      await consumeRateLimit({
        key: rateLimitKey("comment", "user", ctx.user.id),
        limit: 12,
        windowMs: 60 * 1000,
        event: "comment_user_rate_limited",
        userId: ctx.user.id,
        ip,
      });
      await consumeRateLimit({
        key: rateLimitKey("comment", "ip", ip),
        limit: 30,
        windowMs: 60 * 1000,
        event: "comment_ip_rate_limited",
        userId: ctx.user.id,
        ip,
      });

      try {
        assertCommentAllowed(content);
      } catch (err) {
        await recordSecurityEvent({
          event: "comment_blocked",
          subject: `post:${input.postId}`,
          userId: ctx.user.id,
          ip,
          details: { contentLength: content.length },
        });
        throw err;
      }

      const pendingReview = ctx.user.level < 99;
      const comment = await createComment({
        postId: input.postId,
        content,
        authorId: ctx.user.id,
        replyToCommentId: input.replyToCommentId,
        status: pendingReview ? "pending" : "approved",
      });
      return { comment, pendingReview };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const target = await findCommentById(input.id);
      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "评论不存在。",
        });
      }

      const isAdmin = ctx.user.level >= 99;
      if (!isAdmin && target.authorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "只能删除自己发布的评论。",
        });
      }

      const deleted = await deleteCommentThread(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: deleted.parentId ? "delete_comment_reply" : "delete_comment_thread",
        targetType: "comment",
        targetId: deleted.id,
        details: {
          postId: deleted.postId,
          authorId: deleted.authorId,
          parentId: deleted.parentId,
          deletedByOwner: deleted.authorId === ctx.user.id,
        },
      });
      return { success: true };
    }),
});
