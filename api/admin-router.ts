import { z } from "zod";
import bcrypt from "bcryptjs";
import { createRouter, adminQuery } from "./middleware";
import { listUsers, countUsers, updateUser, findUserById, findUserByEmail, createEmailUser, deleteUser } from "./queries/users";
import { createAuditLog } from "./lib/audit";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";
import { desc, eq } from "drizzle-orm";

export const adminRouter = createRouter({
  users: createRouter({
    list: adminQuery
      .input(
        z.object({
          offset: z.number().min(0).default(0),
          limit: z.number().min(1).max(100).default(50),
        }).optional()
      )
      .query(async ({ input }) => {
        const { offset = 0, limit = 50 } = input ?? {};
        const users = await listUsers({ offset, limit });
        const total = await countUsers();
        return { users, total };
      }),

    updateRole: adminQuery
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new Error("不能修改自己的角色");
        }

        const target = await findUserById(input.userId);
        if (!target) {
          throw new Error("用户不存在");
        }

        const oldRole = target.role;
        await updateUser(input.userId, { role: input.role });

        await createAuditLog({
          userId: ctx.user.id,
          action: "update_user_role",
          targetType: "user",
          targetId: input.userId,
          details: { oldRole, newRole: input.role, email: target.email },
        });

        return { success: true };
      }),

    create: adminQuery
      .input(
        z.object({
          name: z.string().min(1).max(50),
          email: z.string().email(),
          password: z.string().min(6).max(100),
          role: z.enum(["user", "admin"]).default("admin"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await findUserByEmail(input.email);
        if (existing) {
          throw new Error("该邮箱已被使用");
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const user = await createEmailUser({
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: "create_user",
          targetType: "user",
          targetId: user?.id,
          details: { email: input.email, role: input.role, name: input.name },
        });

        return { success: true, user };
      }),

    delete: adminQuery
      .input(
        z.object({
          userId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new Error("不能删除自己的账号");
        }

        const target = await findUserById(input.userId);
        if (!target) {
          throw new Error("用户不存在");
        }

        await deleteUser(input.userId);

        await createAuditLog({
          userId: ctx.user.id,
          action: "delete_user",
          targetType: "user",
          targetId: input.userId,
          details: { email: target.email, name: target.name },
        });

        return { success: true };
      }),
  }),

  audit: createRouter({
    logs: adminQuery
      .input(
        z.object({
          offset: z.number().min(0).default(0),
          limit: z.number().min(1).max(100).default(50),
          action: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        const { offset = 0, limit = 50, action } = input ?? {};

        const baseQuery = getDb()
          .select()
          .from(schema.auditLogs)
          .orderBy(desc(schema.auditLogs.createdAt))
          .limit(limit)
          .offset(offset);

        const logs = action
          ? await baseQuery.where(eq(schema.auditLogs.action, action))
          : await baseQuery;

        return { logs };
      }),
  }),
});
