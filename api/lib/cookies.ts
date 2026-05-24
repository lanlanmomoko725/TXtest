import type { CookieOptions } from "hono/utils/cookie";
import { env } from "./env";

function isLocalhost(headers: Headers): boolean {
  const host = headers.get("host") || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function isSecureConnection(headers: Headers): boolean {
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedProto === "https") return true;
  if (forwardedProto === "http") return false;
  return !isLocalhost(headers);
}

export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const secure = isSecureConnection(headers);
  const requestedSameSite = env.cookieSameSite.toLowerCase();
  const sameSite = requestedSameSite === "none" && secure ? "None" : "Lax";

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
  };
}
