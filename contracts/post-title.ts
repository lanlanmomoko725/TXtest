const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    return HTML_ENTITIES[normalized] ?? entity;
  });
}

export function extractPostPlainText(html: string) {
  const text = html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(text).replace(/\s+/g, " ").trim();
}

export function createPostSummary(content: string, maxLength = 30) {
  const plainText = extractPostPlainText(content);
  if (!plainText) return "图片分享";
  return plainText.length > maxLength
    ? `${plainText.slice(0, maxLength)}…`
    : plainText;
}

export function resolvePostTitle(title: string, content: string) {
  return title.trim() || createPostSummary(content);
}
