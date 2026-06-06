import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { createRouter, adminQuery, superAdminQuery } from "./middleware";
import { countUsers, deleteUser, findUserByEmail, findUserById, listUsers, updateUser } from "./queries/users";
import { createAuditLog } from "./lib/audit";
import { getDb } from "./queries/connection";
import * as schema from "@db/schema";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getSuperAdminId(): Promise<number | null> {
  const rows = await getDb()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "super_admin"))
    .limit(1);
  return rows[0]?.id ?? null;
}

export const adminRouter = createRouter({
  users: createRouter({
    list: adminQuery
      .input(
        z.object({
          offset: z.number().min(0).default(0),
          limit: z.number().min(1).max(100).default(50),
        }).optional(),
      )
      .query(async ({ input }) => {
        const { offset = 0, limit = 50 } = input ?? {};
        const users = await listUsers({ offset, limit });
        const total = await countUsers();
        const superAdminId = await getSuperAdminId();
        return { users, total, superAdminId };
      }),

    updateRole: superAdminQuery
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["user", "admin"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new Error("不能修改自己的角色。");
        }

        const target = await findUserById(input.userId);
        if (!target) {
          throw new Error("用户不存在。");
        }
        if (target.role === "super_admin") {
          throw new Error("不能修改超级管理员。");
        }

        const nextLevel = input.role === "admin" ? 99 : 0;
        await updateUser(input.userId, { role: input.role, level: nextLevel });

        await createAuditLog({
          userId: ctx.user.id,
          action: "update_user_role",
          targetType: "user",
          targetId: input.userId,
          details: { oldRole: target.role, newRole: input.role, email: target.email },
        });

        return { success: true };
      }),

    delete: superAdminQuery
      .input(
        z.object({
          userId: z.number(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) {
          throw new Error("不能删除自己的账号。");
        }

        const target = await findUserById(input.userId);
        if (!target) {
          throw new Error("用户不存在。");
        }
        if (target.role === "super_admin") {
          throw new Error("不能删除超级管理员。");
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

    listAdminEmails: superAdminQuery.query(async () => {
      return getDb()
        .select()
        .from(schema.adminEmailAllowlist)
        .orderBy(desc(schema.adminEmailAllowlist.createdAt));
    }),

    addAdminEmail: superAdminQuery
      .input(
        z.object({
          email: z.string().email("请输入有效邮箱地址"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input.email);
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
          throw new Error("该邮箱已经注册，不能通过预授权方式设置为管理员。");
        }

        const [existingAllowlist] = await getDb()
          .select()
          .from(schema.adminEmailAllowlist)
          .where(eq(schema.adminEmailAllowlist.email, email))
          .limit(1);
        if (existingAllowlist) {
          throw new Error(existingAllowlist.usedAt ? "该管理员邮箱已经注册使用。" : "该管理员邮箱已经在预授权列表中。");
        }

        await getDb().insert(schema.adminEmailAllowlist).values({
          email,
          createdBy: ctx.user.id,
          createdAt: new Date(),
        });

        await createAuditLog({
          userId: ctx.user.id,
          action: "add_admin_email",
          targetType: "admin_email",
          targetId: email,
          details: { email },
        });

        return { success: true };
      }),

    removeAdminEmail: superAdminQuery
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const [record] = await getDb()
          .select()
          .from(schema.adminEmailAllowlist)
          .where(eq(schema.adminEmailAllowlist.id, input.id))
          .limit(1);
        if (!record) {
          throw new Error("预授权邮箱不存在。");
        }
        if (record.usedAt) {
          throw new Error("已使用的预授权邮箱不能删除。");
        }

        await getDb().delete(schema.adminEmailAllowlist).where(eq(schema.adminEmailAllowlist.id, input.id));
        await createAuditLog({
          userId: ctx.user.id,
          action: "remove_admin_email",
          targetType: "admin_email",
          targetId: record.email,
          details: { email: record.email },
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
        }).optional(),
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
    securityEvents: adminQuery
      .input(
        z.object({
          offset: z.number().min(0).default(0),
          limit: z.number().min(1).max(100).default(50),
          event: z.string().optional(),
        }).optional(),
      )
      .query(async ({ input }) => {
        const { offset = 0, limit = 50, event } = input ?? {};

        const baseQuery = getDb()
          .select()
          .from(schema.securityEvents)
          .orderBy(desc(schema.securityEvents.createdAt))
          .limit(limit)
          .offset(offset);

        const events = event
          ? await baseQuery.where(eq(schema.securityEvents.event, event))
          : await baseQuery;

        return { events };
      }),
  }),
});
