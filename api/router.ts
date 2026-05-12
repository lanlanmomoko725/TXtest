import { authRouter } from "./auth-router";
import { emailAuthRouter } from "./email-auth-router";
import { postRouter } from "./post-router";
import { commentRouter } from "./comment-router";
import { weeklySkyRouter } from "./weekly-sky-router";
import { aboutRouter } from "./about-router";
import { adminRouter } from "./admin-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  emailAuth: emailAuthRouter,
  admin: adminRouter,
  post: postRouter,
  comment: commentRouter,
  weeklySky: weeklySkyRouter,
  about: aboutRouter,
});

export type AppRouter = typeof appRouter;
