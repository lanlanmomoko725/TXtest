const UPLOAD_PATH_RE = /^\/uploads\/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|gif|webp)$/i;

export function isSafeUploadPath(value: string | null | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed !== value || trimmed.includes("?") || trimmed.includes("#")) return false;
  if (trimmed.includes("%") || trimmed.includes("\\") || trimmed.includes("//")) return false;
  return UPLOAD_PATH_RE.test(trimmed);
}

export function filterSafeUploadPaths(values: unknown): string[] | null {
  if (!Array.isArray(values)) return null;
  const safe = values.filter((value): value is string => typeof value === "string" && isSafeUploadPath(value));
  return safe.length > 0 ? [...new Set(safe)] : null;
}
