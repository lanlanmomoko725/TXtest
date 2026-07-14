import { isIP } from "node:net";

function normalizeIp(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate.slice(0, 45) : null;
}

export function requestIp(headers: Headers): string {
  const realIp = normalizeIp(headers.get("x-real-ip"));
  if (realIp) return realIp;

  const forwardedFor = headers.get("x-forwarded-for")?.split(",");
  for (let index = (forwardedFor?.length ?? 0) - 1; index >= 0; index -= 1) {
    const forwardedIp = normalizeIp(forwardedFor?.[index]);
    if (forwardedIp) return forwardedIp;
  }

  return "unknown";
}

export function requestUserAgent(headers: Headers): string | null {
  const value = headers.get("user-agent")?.trim();
  return value ? value.slice(0, 255) : null;
}
