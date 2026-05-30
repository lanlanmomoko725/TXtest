import {
  BILIBILI_IFRAME_ATTRS,
  normalizeVideoEmbedSrc,
} from "./video-embed";

const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "figcaption",
  "figure",
  "h2",
  "h3",
  "i",
  "iframe",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul",
]);

const VOID_TAGS = new Set(["br", "img"]);
const GLOBAL_ATTRS = new Set(["class", "style", "title"]);
const ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  iframe: new Set(["src", "scrolling", "border", "frameborder", "framespacing", "allowfullscreen", "loading"]),
  img: new Set(["src", "alt", "loading"]),
};

const ALLOWED_STYLE_PROPS = new Set([
  "border-radius",
  "box-shadow",
  "display",
  "float",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-width",
  "text-align",
  "text-indent",
  "width",
]);

function isAllowedUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("/uploads/")) return true;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function sanitizeStyle(value: string): string {
  const rules: string[] = [];
  for (const rawRule of value.split(";")) {
    const [rawName, ...rawValueParts] = rawRule.split(":");
    if (!rawName || rawValueParts.length === 0) continue;
    const name = rawName.trim().toLowerCase();
    const styleValue = rawValueParts.join(":").trim();
    if (!ALLOWED_STYLE_PROPS.has(name)) continue;
    if (!styleValue || /url\s*\(|expression\s*\(|@import|[<>]/i.test(styleValue)) continue;
    if (!/^[\w\s.,()%#/+:-]+$/.test(styleValue)) continue;
    rules.push(`${name}: ${styleValue}`);
  }
  return rules.join("; ");
}

function sanitizeAttr(tagName: string, attrName: string, attrValue: string): string | null {
  const name = attrName.toLowerCase();
  const tagAttrs = ATTRS_BY_TAG[tagName];
  if (!GLOBAL_ATTRS.has(name) && !tagAttrs?.has(name)) return null;
  if (name.startsWith("on")) return null;

  if (tagName === "iframe") {
    if (name === "src") {
      const safeSrc = normalizeVideoEmbedSrc(attrValue);
      return safeSrc ? `src="${escapeAttr(safeSrc)}"` : null;
    }
    if (name === "scrolling") {
      return `scrolling="${BILIBILI_IFRAME_ATTRS.scrolling}"`;
    }
    if (name === "border") {
      return `border="${BILIBILI_IFRAME_ATTRS.border}"`;
    }
    if (name === "frameborder") {
      return `frameborder="${BILIBILI_IFRAME_ATTRS.frameborder}"`;
    }
    if (name === "framespacing") {
      return `framespacing="${BILIBILI_IFRAME_ATTRS.framespacing}"`;
    }
    if (name === "allowfullscreen") {
      return `allowfullscreen="${BILIBILI_IFRAME_ATTRS.allowfullscreen}"`;
    }
    if (name === "loading") {
      return `loading="${BILIBILI_IFRAME_ATTRS.loading}"`;
    }
    if (name === "style") return null;
  }

  if (name === "href" || name === "src") {
    if (!isAllowedUrl(attrValue)) return null;
  }

  if (name === "target") {
    return attrValue === "_blank" ? `target="_blank"` : null;
  }

  if (name === "rel") {
    return `rel="noopener noreferrer"`;
  }

  if (name === "loading") {
    return attrValue === "lazy" ? `loading="lazy"` : null;
  }

  if (name === "class") {
    const safeClass = attrValue
      .split(/\s+/)
      .filter((part) => /^[a-zA-Z0-9_:/.[\]-]+$/.test(part))
      .join(" ");
    return safeClass ? `class="${escapeAttr(safeClass)}"` : null;
  }

  if (name === "style") {
    const safeStyle = sanitizeStyle(attrValue);
    return safeStyle ? `style="${escapeAttr(safeStyle)}"` : null;
  }

  return `${name}="${escapeAttr(attrValue)}"`;
}

function sanitizeAttrs(tagName: string, rawAttrs: string): string {
  const attrs: string[] = [];
  const iframeAttrNames = new Set<string>();
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const attrName = match[1].toLowerCase();
    const value = match[2].replace(/^["']|["']$/g, "");
    const safeAttr = sanitizeAttr(tagName, attrName, value);
    if (safeAttr) {
      attrs.push(safeAttr);
      if (tagName === "iframe") iframeAttrNames.add(attrName);
    }
  }

  if (tagName === "iframe" && iframeAttrNames.has("src")) {
    if (!iframeAttrNames.has("scrolling")) attrs.push(`scrolling="${BILIBILI_IFRAME_ATTRS.scrolling}"`);
    if (!iframeAttrNames.has("border")) attrs.push(`border="${BILIBILI_IFRAME_ATTRS.border}"`);
    if (!iframeAttrNames.has("frameborder")) attrs.push(`frameborder="${BILIBILI_IFRAME_ATTRS.frameborder}"`);
    if (!iframeAttrNames.has("framespacing")) attrs.push(`framespacing="${BILIBILI_IFRAME_ATTRS.framespacing}"`);
    if (!iframeAttrNames.has("allowfullscreen")) {
      attrs.push(`allowfullscreen="${BILIBILI_IFRAME_ATTRS.allowfullscreen}"`);
    }
    if (!iframeAttrNames.has("loading")) attrs.push(`loading="${BILIBILI_IFRAME_ATTRS.loading}"`);
  }
  return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";

  let output = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!doctype[\s\S]*?>/gi, "")
    .replace(/<(script|style|object|embed|meta|link|svg|math)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|object|embed|meta|link|svg|math)\b[^>]*\/?>/gi, "");

  output = output.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (raw, rawTagName: string, rawAttrs: string) => {
    const tagName = rawTagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) return "";
    const isClosing = /^<\//.test(raw);
    if (isClosing) {
      return VOID_TAGS.has(tagName) ? "" : `</${tagName}>`;
    }
    const attrs = sanitizeAttrs(tagName, rawAttrs);
    return VOID_TAGS.has(tagName) ? `<${tagName}${attrs}>` : `<${tagName}${attrs}>`;
  });

  return output.replace(/<iframe(?![^>]*\ssrc=)[^>]*>\s*<\/iframe>/gi, "");
}
