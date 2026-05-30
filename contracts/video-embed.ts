export type VideoPlatform = "bilibili" | "tencent";

export interface VideoEmbed {
  platform: VideoPlatform;
  embedSrc: string;
  originalUrl: string;
  title: string;
}

export const VIDEO_IFRAME_ALLOW = "fullscreen; autoplay; encrypted-media; picture-in-picture";
export const VIDEO_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-presentation allow-popups";
export const VIDEO_IFRAME_REFERRER_POLICY = "no-referrer-when-downgrade";

const BILIBILI_BVID_RE = /^BV[a-zA-Z0-9]+$/;
const BILIBILI_AID_RE = /^(?:av)?(\d+)$/i;
const TENCENT_VID_RE = /^[a-zA-Z0-9]{6,64}$/;

export function parseVideoUrl(rawUrl: string, rawTitle = ""): VideoEmbed | null {
  const url = parseHttpUrl(rawUrl);
  if (!url) return null;

  const bilibili = parseBilibiliUrl(url, rawTitle);
  if (bilibili) return bilibili;

  return parseTencentUrl(url, rawTitle);
}

export function isAllowedVideoEmbedSrc(rawSrc: string): boolean {
  return normalizeVideoEmbedSrc(rawSrc) !== null;
}

export function normalizeVideoEmbedSrc(rawSrc: string): string | null {
  const url = parseHttpUrl(rawSrc);
  if (!url || url.protocol !== "https:") return null;

  const host = normalizeHost(url.hostname);
  if (host === "player.bilibili.com") {
    return normalizePath(url.pathname) === "/player.html" ? buildBilibiliEmbed(url.searchParams) : null;
  }
  if (host === "v.qq.com") {
    if (normalizePath(url.pathname) !== "/txp/iframe/player.html") return null;
    const vid = url.searchParams.get("vid");
    return vid && TENCENT_VID_RE.test(vid)
      ? `https://v.qq.com/txp/iframe/player.html?vid=${encodeURIComponent(vid)}`
      : null;
  }
  return null;
}

function parseBilibiliUrl(url: URL, rawTitle: string): VideoEmbed | null {
  const host = normalizeHost(url.hostname);

  if (host === "player.bilibili.com" && normalizePath(url.pathname) === "/player.html") {
    const embedSrc = buildBilibiliEmbed(url.searchParams);
    if (!embedSrc) return null;
    const bvid = url.searchParams.get("bvid");
    const aid = url.searchParams.get("aid");
    return {
      platform: "bilibili",
      embedSrc,
      originalUrl: bvid
        ? `https://www.bilibili.com/video/${bvid}`
        : aid
          ? `https://www.bilibili.com/video/av${aid}`
          : toHttpsUrl(url),
      title: normalizeVideoTitle(rawTitle, "哔哩哔哩视频"),
    };
  }

  if (!host.endsWith("bilibili.com")) return null;
  const match = normalizePath(url.pathname).match(/^\/video\/([^/?#]+)/i);
  if (!match) return null;

  const id = match[1];
  const params = new URLSearchParams();
  if (BILIBILI_BVID_RE.test(id)) {
    params.set("bvid", id);
  } else {
    const aidMatch = id.match(BILIBILI_AID_RE);
    if (!aidMatch) return null;
    params.set("aid", aidMatch[1]);
  }

  const page = firstPositiveInt(url.searchParams.get("p"), url.searchParams.get("page"));
  if (page) params.set("page", page);
  params.set("autoplay", "0");

  return {
    platform: "bilibili",
    embedSrc: `https://player.bilibili.com/player.html?${params.toString()}`,
    originalUrl: toHttpsUrl(url),
    title: normalizeVideoTitle(rawTitle, "哔哩哔哩视频"),
  };
}

function parseTencentUrl(url: URL, rawTitle: string): VideoEmbed | null {
  const host = normalizeHost(url.hostname);
  if (host !== "v.qq.com") return null;

  const path = normalizePath(url.pathname);
  let vid: string | null = null;

  if (path === "/txp/iframe/player.html") {
    vid = url.searchParams.get("vid");
  } else {
    vid = path.match(/^\/x\/page\/([a-zA-Z0-9]+)\.html$/)?.[1] ?? null;
    vid ??= path.match(/^\/x\/cover\/[^/]+\/([a-zA-Z0-9]+)\.html$/)?.[1] ?? null;
  }

  if (!vid || !TENCENT_VID_RE.test(vid)) return null;

  return {
    platform: "tencent",
    embedSrc: `https://v.qq.com/txp/iframe/player.html?vid=${encodeURIComponent(vid)}`,
    originalUrl: path === "/txp/iframe/player.html" ? `https://v.qq.com/x/page/${vid}.html` : toHttpsUrl(url),
    title: normalizeVideoTitle(rawTitle, "腾讯视频"),
  };
}

function buildBilibiliEmbed(params: URLSearchParams): string | null {
  const output = new URLSearchParams();
  const bvid = params.get("bvid");
  const aid = params.get("aid");
  const cid = params.get("cid");
  const page = firstPositiveInt(params.get("page"), params.get("p"));

  if (bvid && BILIBILI_BVID_RE.test(bvid)) output.set("bvid", bvid);
  if (aid && /^\d+$/.test(aid)) output.set("aid", aid);
  if (cid && /^\d+$/.test(cid)) output.set("cid", cid);
  if (page) output.set("page", page);
  output.set("autoplay", "0");

  const hasVideoId = output.has("bvid") || output.has("aid") || output.has("cid");
  return hasVideoId ? `https://player.bilibili.com/player.html?${output.toString()}` : null;
}

function parseHttpUrl(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001f<>]/.test(trimmed)) return null;

  const normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

function firstPositiveInt(...values: Array<string | null>): string | null {
  for (const value of values) {
    if (value && /^[1-9]\d{0,2}$/.test(value)) return value;
  }
  return null;
}

function toHttpsUrl(url: URL): string {
  const normalized = new URL(url.href);
  normalized.protocol = "https:";
  normalized.hash = "";
  return normalized.href;
}

function normalizeVideoTitle(rawTitle: string, fallback: string): string {
  const title = rawTitle.trim().replace(/\s+/g, " ");
  return title.slice(0, 120) || fallback;
}
