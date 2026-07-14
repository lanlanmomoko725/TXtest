import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { findAboutUs, upsertAboutUs } from "./queries/about";

export const aboutRouter = createRouter({
  get: publicQuery.query(async () => {
    return findAboutUs();
  }),

  update: adminQuery
    .input(
      z.object({
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return upsertAboutUs(input, ctx.user.id);
    }),
});
