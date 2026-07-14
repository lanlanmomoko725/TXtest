import { eq, inArray } from "drizzle-orm";
import * as schema from "@db/schema";
import { isSafeUploadPath } from "@contracts/upload-path";
import { getDb } from "../queries/connection";
import { env } from "./env";
import { recordSecurityEvent } from "./security-events";

export type UploadPurpose = "avatar" | "content";

export function extractUploadPathsFromHtml(html: string | null | undefined): string[] {
  if (!html) return [];
  const paths: string[] = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    if (isSafeUploadPath(match[1])) paths.push(match[1]);
  }
  return [...new Set(paths)];
}

export async function registerUploadedFile(params: {
  path: string;
  uploaderUserId: number;
  purpose: UploadPurpose;
  sizeBytes: number;
  format: string;
}) {
  await getDb().insert(schema.uploadedFiles).values({
    path: params.path,
    uploaderUserId: params.uploaderUserId,
    purpose: params.purpose,
    sizeBytes: params.sizeBytes,
    format: params.format.slice(0, 16),
    createdAt: new Date(),
  });
}

export async function assertUsableUploadPaths(params: {
  paths: Array<string | null | undefined>;
  userId: number;
  purpose: UploadPurpose;
  legacyPaths?: Array<string | null | undefined>;
}) {
  const paths = [...new Set(params.paths.filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  if (paths.some((path) => !isSafeUploadPath(path))) {
    throw new Error("图片路径无效。");
  }

  const legacyPaths = new Set(
    (params.legacyPaths ?? []).filter((path): path is string => Boolean(path) && isSafeUploadPath(path)),
  );
  const rows = await getDb()
    .select()
    .from(schema.uploadedFiles)
    .where(inArray(schema.uploadedFiles.path, paths));
  const fileMap = new Map(rows.map((row) => [row.path, row]));

  const violations = paths.filter((path) => {
    if (legacyPaths.has(path)) return false;
    const file = fileMap.get(path);
    return !file || file.uploaderUserId !== params.userId || file.purpose !== params.purpose;
  });
  if (violations.length === 0) return;

  await recordSecurityEvent({
    event: "upload_ownership_violation",
    subject: `user:${params.userId}`,
    userId: params.userId,
    details: {
      purpose: params.purpose,
      mode: env.uploadOwnershipMode,
      paths: violations.slice(0, 20),
    },
  });
  if (env.uploadOwnershipMode === "enforce") {
    throw new Error("图片不属于当前账号或上传用途不匹配，请重新上传。");
  }
}

export async function uploadedFileBelongsTo(path: string, userId: number, purpose: UploadPurpose) {
  const [file] = await getDb()
    .select()
    .from(schema.uploadedFiles)
    .where(eq(schema.uploadedFiles.path, path))
    .limit(1);
  return Boolean(file && file.uploaderUserId === userId && file.purpose === purpose);
}
