import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { findCommentsByPost, createComment } from "./queries/comments";

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
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createComment({
        postId: input.postId,
        content: input.content,
        authorId: ctx.user.id,
      });
    }),
});
