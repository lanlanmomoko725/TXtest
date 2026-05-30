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

export const SKY_CATEGORY_IDS = [
  "cloud_types",
  "rainbow",
  "glory",
  "ice_halo",
  "mirage",
  "lightning",
  "sky_color",
] as const;

export const SKY_CATEGORIES = [
  { id: "cloud_types", label: "云的种类", description: "积云、层云、卷云、积雨云等各种云状" },
  { id: "rainbow", label: "彩虹类", description: "彩虹、双彩虹、月虹等折射现象" },
  { id: "glory", label: "宝光类", description: "宝光、华、彩云等衍射现象" },
  { id: "ice_halo", label: "冰晕类", description: "日晕、月晕、幻日、幻月等冰晶光学现象" },
  { id: "mirage", label: "蜃景类", description: "海市蜃楼、上现蜃景、下现蜃景等折射现象" },
  { id: "lightning", label: "电光类", description: "闪电、雷暴、红色精灵等大气电现象" },
  { id: "sky_color", label: "天空的色彩与光影", description: "朝霞、晚霞、暮光、反曙暮光等天空光影" },
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
  cloud_types: "云的种类",
  rainbow: "彩虹类",
  glory: "宝光类",
  ice_halo: "冰晕类",
  mirage: "蜃景类",
  lightning: "电光类",
  sky_color: "天空的色彩与光影",
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
