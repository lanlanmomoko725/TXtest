import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { updateUser } from "./queries/users";
import { z } from "zod";

function validateNameLength(name: string): boolean {
  let length = 0;
  for (const char of name) {
    length += char.charCodeAt(0) > 127 ? 2 : 1;
  }
  return length <= 20;
}

function clearAuthCookies(resHeaders: Headers, reqHeaders: Headers) {
  const opts = getSessionCookieOptions(reqHeaders);
  for (const name of [Session.accessCookieName, Session.refreshCookieName]) {
    resHeaders.append(
      "set-cookie",
      cookie.serialize(name, "", {
        httpOnly: true,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
  }
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    clearAuthCookies(ctx.resHeaders, ctx.req.headers);
    return { success: true };
  }),
  updateProfile: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(20).optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user!;
      if (input.name && !validateNameLength(input.name)) {
        throw new Error("昵称过长：最多10个汉字或20个英文字母");
      }
      const updated = await updateUser(user.id, {
        name: input.name,
        avatar: input.avatar,
      });
      return updated;
    }),
});
