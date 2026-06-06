import { env } from "./env";

export const COMMENT_REJECT_MESSAGE = "评论包含不适合发布的内容，请修改后再试。";

type FilterOptions = {
  blocklist?: string;
  patterns?: string;
};

function splitValues(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeForKeyword(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[0０]/g, "o")
    .replace(/[1１!！|]/g, "i")
    .replace(/[3３]/g, "e")
    .replace(/[4４@＠]/g, "a")
    .replace(/[5５$＄]/g, "s")
    .replace(/[7７]/g, "t")
    .replace(/[\s\p{P}\p{S}\u200b-\u200d\ufeff]+/gu, "");
}

export function isCommentBlocked(content: string, options?: FilterOptions) {
  const normalizedContent = normalizeForKeyword(content);
  const blocklist = splitValues(options?.blocklist ?? env.commentBlocklist);

  for (const word of blocklist) {
    const normalizedWord = normalizeForKeyword(word);
    if (normalizedWord && normalizedContent.includes(normalizedWord)) {
      return true;
    }
  }

  const patterns = splitValues(options?.patterns ?? env.commentBlockPatterns);
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern, "iu").test(content)) {
        return true;
      }
    } catch {
      // Invalid custom patterns should not break commenting.
    }
  }

  return false;
}

export function assertCommentAllowed(content: string) {
  if (isCommentBlocked(content)) {
    throw new Error(COMMENT_REJECT_MESSAGE);
  }
}
