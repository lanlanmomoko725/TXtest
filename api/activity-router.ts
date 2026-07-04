import { z } from "zod";
import { createRouter, l99Query, publicQuery } from "./middleware";
import {
  createActivity,
  deleteActivity,
  findActivities,
  findActivityArchive,
  findActivityById,
} from "./queries/activities";
import { createAuditLog } from "./lib/audit";

const activityDateInput = {
  year: z.number().int().min(1900).max(2200).optional(),
  month: z.number().int().min(1).max(12).optional(),
};

export const activityRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        ...activityDateInput,
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional(),
    )
    .query(({ input }) => findActivities(input ?? {})),

  byId: publicQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ input }) => findActivityById(input.id)),

  archive: publicQuery.query(() => findActivityArchive()),

  create: l99Query
    .input(
      z.object({
        title: z.string().trim().min(1).max(255),
        content: z.string().min(1),
        coverImage: z.string().optional(),
        activityYear: z.number().int().min(1900).max(2200),
        activityMonth: z.number().int().min(1).max(12),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activity = await createActivity({
        ...input,
        createdBy: ctx.user.id,
      });
      if (activity) {
        await createAuditLog({
          userId: ctx.user.id,
          action: "create_activity",
          targetType: "activity",
          targetId: activity.id,
          details: { title: activity.title, year: activity.activityYear, month: activity.activityMonth },
        });
      }
      return activity;
    }),

  delete: l99Query
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const activity = await deleteActivity(input.id);
      await createAuditLog({
        userId: ctx.user.id,
        action: "delete_activity",
        targetType: "activity",
        targetId: input.id,
        details: { title: activity.title, year: activity.activityYear, month: activity.activityMonth },
      });
      return { success: true };
    }),
});
