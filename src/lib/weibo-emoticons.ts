import emoticonManifest from "@/data/weibo-emoticons.json";

const EMOTICONS = emoticonManifest as Record<string, string>;
const SHORTCODE_PATTERN = /\[([^\[\]\r\n]{1,16})\]/g;
const ZERO_WIDTH_ARTIFACT_PATTERN = /[\u200b\ufeff]/;

export type EmoticonToken =
  | { type: "text"; value: string }
  | { type: "emoticon"; alias: string; src: string };

export function getWeiboEmoticonSource(alias: string) {
  return EMOTICONS[alias];
}

export function tokenizeWeiboEmoticons(text: string): EmoticonToken[] {
  const tokens: EmoticonToken[] = [];
  const pattern = new RegExp(SHORTCODE_PATTERN);
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const alias = match[1];
    const src = getWeiboEmoticonSource(alias);
    if (!src) continue;

    if (match.index > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, match.index) });
    }
    tokens.push({ type: "emoticon", alias, src });

    cursor = pattern.lastIndex;
    while (cursor < text.length && ZERO_WIDTH_ARTIFACT_PATTERN.test(text[cursor])) {
      cursor += 1;
    }
    pattern.lastIndex = cursor;
  }

  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: text }];
}

export function renderWeiboEmoticonsHtml(text: string) {
  return tokenizeWeiboEmoticons(text)
    .map((token) => {
      if (token.type === "text") return token.value;
      const shortcode = `[${token.alias}]`;
      return `<img src="${token.src}" alt="${shortcode}" title="${shortcode}" loading="lazy" draggable="false" data-emoticon="true" class="mx-0.5 inline-block h-[1.35em] w-[1.35em] max-w-none align-[-0.22em] object-contain">`;
    })
    .join("");
}
