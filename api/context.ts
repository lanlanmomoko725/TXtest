import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { verifyAccessToken, verifyRefreshToken, signAccessToken } from "./lib/session";
import { findUserById } from "./queries/users";
import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function authenticateRequest(headers: Headers, resHeaders: Headers): Promise<User | undefined> {
  const cookies = cookie.parse(headers.get("cookie") || "");

  // 1. Try access token first
  const accessToken = cookies[Session.accessCookieName];
  if (accessToken) {
    const claim = await verifyAccessToken(accessToken);
    if (claim?.userId) {
      const user = await findUserById(claim.userId);
      if (user && user.sessionVersion === claim.sessionVersion) return user;
    }
  }

  // 2. If access token expired, try refresh token
  const refreshToken = cookies[Session.refreshCookieName];
  if (refreshToken) {
    const claim = await verifyRefreshToken(refreshToken);
    if (claim?.userId) {
      const user = await findUserById(claim.userId);
      if (!user || user.sessionVersion !== claim.sessionVersion) return undefined;
      // Issue new access token transparently
      const newAccessToken = await signAccessToken(claim.userId, user.sessionVersion);
      const opts = getSessionCookieOptions(headers);
      resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.accessCookieName, newAccessToken, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.accessMaxAgeMs / 1000,
        }),
      );
      return user;
    }
  }

  return undefined;
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers, opts.resHeaders);
  } catch {
    // Authentication is optional here
  }
  return ctx;
}
