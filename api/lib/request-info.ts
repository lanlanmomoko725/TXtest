export function requestIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  ).slice(0, 45);
}

export function requestUserAgent(headers: Headers): string | null {
  const value = headers.get("user-agent")?.trim();
  return value ? value.slice(0, 255) : null;
}
