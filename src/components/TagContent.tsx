import { escapeAttr, escapeHtml, sanitizeHtml } from "@contracts/html-sanitizer";

interface TagContentProps {
  html: string;
  className?: string;
}

const URL_REGEX = /https?:\/\/(www\.)?([^\s<>"')\]]+)/gi;

const DOMAIN_KEYWORDS: Record<string, { label: string; color: string }> = {
  "weibo.com": { label: "Weibo", color: "text-red-500 bg-red-50" },
  "t.cn": { label: "Weibo", color: "text-red-500 bg-red-50" },
  "bilibili.com": { label: "Bilibili", color: "text-pink-500 bg-pink-50" },
  "b23.tv": { label: "Bilibili", color: "text-pink-500 bg-pink-50" },
  "zhihu.com": { label: "Zhihu", color: "text-blue-600 bg-blue-50" },
  "douyin.com": { label: "Douyin", color: "text-fuchsia-600 bg-fuchsia-50" },
  "xiaohongshu.com": { label: "Xiaohongshu", color: "text-rose-500 bg-rose-50" },
  "xhslink.com": { label: "Xiaohongshu", color: "text-rose-500 bg-rose-50" },
  "baidu.com": { label: "Baidu", color: "text-sky-600 bg-sky-50" },
  "qq.com": { label: "QQ", color: "text-sky-600 bg-sky-50" },
  "github.com": { label: "GitHub", color: "text-gray-700 bg-gray-100" },
  "mp.weixin.qq.com": { label: "WeChat", color: "text-green-600 bg-green-50" },
};

function linkKeyword(hostname: string): { label: string; color: string } {
  for (const [domain, keyword] of Object.entries(DOMAIN_KEYWORDS)) {
    if (hostname === domain || hostname.endsWith("." + domain)) return keyword;
  }
  return { label: "Link", color: "text-slate-500 bg-slate-100" };
}

function enhanceText(text: string): string {
  const withTags = text.replace(/#([^#\s]+)#/g, (_fullMatch, tag: string) => {
    const safeTag = escapeHtml(tag);
    const encodedTag = encodeURIComponent(tag);
    return `<a href="/tag/${encodedTag}" class="inline-flex items-center text-sky-500 hover:text-sky-600 font-medium no-underline bg-sky-50 px-1 rounded transition-colors" data-tag="${escapeAttr(tag)}">#${safeTag}#</a>`;
  });

  return withTags.replace(URL_REGEX, (url) => {
    let hostname = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    const keyword = linkKeyword(hostname);
    return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 ${keyword.color} px-1.5 py-0.5 rounded font-medium no-underline hover:brightness-95 transition-all">${escapeHtml(keyword.label)}<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>`;
  });
}

export default function TagContent({ html, className = "" }: TagContentProps) {
  const safeHtml = sanitizeHtml(html);
  const parts: { type: "html" | "text"; value: string }[] = [];
  let lastIndex = 0;
  const htmlTagRegex = /<[^>]+>/g;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = htmlTagRegex.exec(safeHtml)) !== null) {
    if (tagMatch.index > lastIndex) {
      parts.push({ type: "text", value: safeHtml.slice(lastIndex, tagMatch.index) });
    }
    parts.push({ type: "html", value: tagMatch[0] });
    lastIndex = tagMatch.index + tagMatch[0].length;
  }
  if (lastIndex < safeHtml.length) {
    parts.push({ type: "text", value: safeHtml.slice(lastIndex) });
  }

  const processedHtml = parts
    .map((part) => (part.type === "html" ? part.value : enhanceText(part.value)))
    .join("");

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a[data-tag]") as HTMLAnchorElement | null;
        if (anchor) {
          e.preventDefault();
          const tag = anchor.getAttribute("data-tag");
          if (tag) {
            window.location.href = `/tag/${encodeURIComponent(tag)}`;
          }
        }
      }}
    />
  );
}
