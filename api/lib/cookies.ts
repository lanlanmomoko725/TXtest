import type { CookieOptions } from "hono/utils/cookie";

function isLocalhost(headers: Headers): boolean {
  const host = headers.get("host") || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function isSecureConnection(headers: Headers): boolean {
  // 如果通过反向代理（如 Nginx），使用 X-Forwarded-Proto 判断实际协议
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedProto === "https") return true;
  if (forwardedProto === "http") return false;

  // 直连时根据 host 判断
  return !isLocalhost(headers);
}

export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const secure = isSecureConnection(headers);

  return {
    httpOnly: true,
    path: "/",
    // SameSite=None 必须配合 Secure，否则浏览器会拒绝
    sameSite: secure ? "None" : "Lax",
    secure,
  };
}
