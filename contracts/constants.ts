export const Session = {
  accessCookieName: "kimi_access",
  refreshCookieName: "kimi_sid",
  accessMaxAgeMs: 15 * 60 * 1000,            // 15 minutes
  refreshMaxAgeMs: 7 * 24 * 60 * 60 * 1000,  // 7 days
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
} as const;

export const SKY_CATEGORIES = [
  { id: "cloud", label: "云", description: "积云、层云、卷云、积雨云等各种云状" },
  { id: "halo", label: "晕", description: "日晕、月晕、幻日、幻月等光学现象" },
  { id: "glory", label: "华", description: "日华、月华、彩云等衍射现象" },
  { id: "rainbow", label: "虹", description: "彩虹、双彩虹、月虹等折射现象" },
  { id: "other", label: "其它天象", description: "极光、流星雨、彗星、奇云等特殊天象" },
] as const;

export type SkyCategory = (typeof SKY_CATEGORIES)[number]["id"];

export const REGIONS = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
  "港澳台",
  "海外",
] as const;

export type Region = (typeof REGIONS)[number];

export const CATEGORY_LABEL_MAP: Record<SkyCategory, string> = {
  cloud: "云",
  halo: "晕",
  glory: "华",
  rainbow: "虹",
  other: "其它天象",
};

export const SKY_GALLERY_CATEGORIES = [
  "云的种类",
  "彩虹类",
  "宝光类",
  "冰晕类",
  "蜃景类",
  "电光类",
  "天空的色彩与光影",
] as const;

export type SkyGalleryCategory = (typeof SKY_GALLERY_CATEGORIES)[number];
