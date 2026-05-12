interface TagContentProps {
  html: string;
  className?: string;
}

const URL_REGEX = /https?:\/\/(www\.)?([^\s<>"')\]]+)/gi;

const DOMAIN_KEYWORDS: Record<string, { label: string; color: string }> = {
  "weibo.com": { label: "微博", color: "text-red-500 bg-red-50" },
  "t.cn": { label: "微博", color: "text-red-500 bg-red-50" },
  "bilibili.com": { label: "B站", color: "text-pink-500 bg-pink-50" },
  "b23.tv": { label: "B站", color: "text-pink-500 bg-pink-50" },
  "zhihu.com": { label: "知乎", color: "text-blue-600 bg-blue-50" },
  "douyin.com": { label: "抖音", color: "text-fuchsia-600 bg-fuchsia-50" },
  "xiaohongshu.com": { label: "小红书", color: "text-rose-500 bg-rose-50" },
  "xhslink.com": { label: "小红书", color: "text-rose-500 bg-rose-50" },
  "baidu.com": { label: "百度", color: "text-sky-600 bg-sky-50" },
  "qq.com": { label: "腾讯", color: "text-sky-600 bg-sky-50" },
  "github.com": { label: "GitHub", color: "text-gray-700 bg-gray-100" },
  "mp.weixin.qq.com": { label: "公众号", color: "text-green-600 bg-green-50" },
};

function linkKeyword(hostname: string): { label: string; color: string } {
  for (const [domain, kw] of Object.entries(DOMAIN_KEYWORDS)) {
    if (hostname === domain || hostname.endsWith("." + domain)) return kw;
  }
  return { label: "网页链接", color: "text-slate-500 bg-slate-100" };
}

/**
 * Render HTML content with #tag# highlighted as clickable sky-blue links.
 * Tags are detected by the pattern #word# outside of HTML tags.
 */
export default function TagContent({ html, className = "" }: TagContentProps) {
  // Replace #tag# with clickable links, but only in text content (not inside HTML attributes)
  // We use a two-step approach:
  // 1. Temporarily replace HTML tags with placeholders
  // 2. Replace #tag# in the remaining text
  // 3. Restore HTML tags

  const tagRegex = /#([^#\s]+)#/g;

  // Split by HTML tags to avoid replacing inside attributes
  const parts: { type: "html" | "text"; value: string }[] = [];
  let lastIndex = 0;
  const htmlTagRegex = /<[^>]+>/g;
  let match;

  while ((match = htmlTagRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: html.slice(lastIndex, match.index) });
    }
    parts.push({ type: "html", value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < html.length) {
    parts.push({ type: "text", value: html.slice(lastIndex) });
  }

  const processedHtml = parts
    .map((part) => {
      if (part.type === "html") return part.value;
      // Replace #tag# with links
      let text = part.value.replace(tagRegex, (match, tag) => {
        return `<a href="/tag/${encodeURIComponent(tag)}" class="inline-flex items-center text-sky-500 hover:text-sky-600 font-medium no-underline bg-sky-50 px-1 rounded transition-colors" data-tag="${tag}">#${tag}#</a>`;
      });
      // Replace URLs with source-keyword links
      text = text.replace(URL_REGEX, (url) => {
        let hostname = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
        const kw = linkKeyword(hostname);
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 ${kw.color} px-1.5 py-0.5 rounded font-medium no-underline hover:brightness-95 transition-all">${kw.label}<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>`;
      });
      return text;
    })
    .join("");

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a[data-tag]') as HTMLAnchorElement | null;
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
