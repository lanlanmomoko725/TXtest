export type ImageFormat = "jpg" | "png" | "gif" | "webp" | "heif";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function detectImageFormat(buffer: Buffer<ArrayBufferLike>): ImageFormat | null {
  const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8;
  if (isJpg) return "jpg";

  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (isPng) return "png";

  const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  if (isGif) return "gif";

  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (isWebp) return "webp";

  const isHeif =
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    ((buffer[8] === 0x68 && buffer[9] === 0x65) ||
      (buffer[8] === 0x6d && buffer[9] === 0x69) ||
      (buffer[8] === 0x6d && buffer[9] === 0x73));
  if (isHeif) return "heif";

  return null;
}

export function extensionForFormat(format: ImageFormat): string {
  return format === "heif" ? "jpg" : format;
}
