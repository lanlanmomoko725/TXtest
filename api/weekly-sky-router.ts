import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import { findWeeklySky, upsertWeeklySky } from "./queries/weekly-sky";

export const weeklySkyRouter = createRouter({
  get: publicQuery.query(async () => {
    return findWeeklySky();
  }),

  update: adminQuery
    .input(
      z.object({
        image: z.string().optional(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return upsertWeeklySky(input, ctx.user.id);
    }),
});
