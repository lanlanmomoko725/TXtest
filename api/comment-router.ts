import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware";
import { findCommentsByPost, createComment, deleteCommentThread } from "./queries/comments";
import { assertCommentAllowed } from "./lib/comment-filter";
import { createAuditLog } from "./lib/audit";

export const commentRouter = createRouter({
  list: publicQuery
    .input(z.object({ postId: z.number() }))
    .query(async ({ input }) => {
      return findCommentsByPost(input.postId);
    }),

  create: authedQuery
    .input(
      z.object({
        postId: z.number(),
        content: z.string().min(1).max(2000),
        replyToCommentId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const content = input.content.trim();
      if (!content) {
        throw new Error("评论不能为空。");
      }
      assertCommentAllowed(content);
      return createComment({
        postId: input.postId,
        content,
        authorId: ctx.user.id,
        replyToCommentId: input.replyToCommentId,
      });
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
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
        },
      });
      return { success: true };
    }),
});
