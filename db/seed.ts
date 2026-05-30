import { getDb } from "../api/queries/connection";
import * as schema from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloud image URLs from Unsplash (free to use)
const CLOUD_IMAGES = [
  "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80",
  "https://images.unsplash.com/photo-1527482797697-8795b05a13fe?w=800&q=80",
  "https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=800&q=80",
  "https://images.unsplash.com/photo-1499346030926-9a72daac6af9?w=800&q=80",
];

const RAINBOW_IMAGES = [
  "https://images.unsplash.com/photo-1524311796748-05b0883d5792?w=800&q=80",
  "https://images.unsplash.com/photo-1470290449668-02dd93d9420a?w=800&q=80",
];

const SUNSET_IMAGES = [
  "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80",
  "https://images.unsplash.com/photo-1495616811223-4d98c6e9d869?w=800&q=80",
  "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=800&q=80",
];

const HALO_IMAGES = [
  "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=800&q=80",
];

const GLORY_IMAGES = [
  "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=800&q=80",
];

const OTHER_IMAGES = [
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
  "https://images.unsplash.com/photo-1464802686167-b939a6910659?w=800&q=80",
  "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80",
];

function generatePassword(length = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join("");
}

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Check if we already have posts
  const existingPosts = await db.select().from(schema.posts).limit(1);
  if (existingPosts.length > 0) {
    console.log("Database already has data, skipping seed.");
    process.exit(0);
  }

  // Create email test users with randomly generated passwords
  const testUsers = [
    { name: "追云者", email: "user1@tianxiang.com", role: "user" as const },
    { name: "天际观测员", email: "user2@tianxiang.com", role: "user" as const },
    { name: "虹彩猎手", email: "user3@tianxiang.com", role: "user" as const },
    { name: "天象测试员", email: "test@tianxiang.com", role: "admin" as const },
    { name: "云图管理员", email: "admin1@tianxiang.com", role: "admin" as const },
    { name: "天空观测长", email: "admin2@tianxiang.com", role: "admin" as const },
    { name: "气象总监", email: "admin3@tianxiang.com", role: "admin" as const },
  ];

  const accountRecords: { name: string; email: string; password: string; role: string }[] = [];
  const userIds: number[] = [];

  for (const user of testUsers) {
    const password = generatePassword(10);
    const hashedPassword = await bcrypt.hash(password, 10);
    const [{ id }] = await db.insert(schema.users).values({
      name: user.name,
      email: user.email,
      password: hashedPassword,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email.split("@")[0]}`,
      role: user.role,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignInAt: new Date(),
    }).$returningId();
    userIds.push(id);
    accountRecords.push({ name: user.name, email: user.email, password, role: user.role });
    console.log(`Created user: ${user.name} (ID: ${id}) - ${user.email}`);
  }

  // Create posts
  const posts = [
    // Cloud posts
    {
      title: "今日傍晚的积雨云，壮观无比！",
      content: "<p>今天傍晚在北京上空拍到了这组积雨云，云层高耸入云，顶部呈现砧状结构。当时天气闷热，午后有雷阵雨，这正是积雨云典型的形成条件。</p><p>拍摄设备：Sony A7R4 + 24-70mm GM</p><p>拍摄时间：2024年7月15日 18:30</p>",
      authorId: userIds[0],
      category: "cloud_types" as const,
      region: "北京",
      hasLocation: true,
      images: [CLOUD_IMAGES[0], CLOUD_IMAGES[1]],
      isArticle: false,
      isFeatured: true,
      viewCount: 342,
    },
    {
      title: "云南大理的云海日出",
      content: "<p>在大理苍山拍到的绝美云海，日出时分金光洒满云海，宛如仙境。这种层积云形成的云海需要特定的地形和气候条件，苍山洱海的地形正好满足。</p><p>建议大家如果想拍云海，最好在日出前一小时到达拍摄点，准备好三脚架和广角镜头。</p>",
      authorId: userIds[1],
      category: "cloud_types" as const,
      region: "云南",
      hasLocation: true,
      images: [CLOUD_IMAGES[2]],
      isArticle: true,
      isFeatured: true,
      viewCount: 891,
    },
    {
      title: "罕见的滚轴云掠过海岸线",
      content: "<p>在福建厦门海边拍到的滚轴云（Arcus Cloud），这种云非常罕见，通常出现在强雷暴的前缘。看到它的时候真的被震撼到了，像一堵云墙从海面上推过来。</p>",
      authorId: userIds[2],
      category: "cloud_types" as const,
      region: "福建",
      hasLocation: true,
      images: [CLOUD_IMAGES[3]],
      isArticle: false,
      isFeatured: false,
      viewCount: 567,
    },
    // Halo posts
    {
      title: "完整的22度日晕，带幻日环！",
      content: "<p>今天在哈尔滨拍到了完整的22度日晕，惊喜的是两侧还出现了幻日（Sundogs）！这种光学现象需要高空卷云中大量的六角形冰晶才能形成。</p><p>拍摄技巧：拍摄日晕时曝光补偿要降低2-3档，否则太阳会过曝。</p>",
      authorId: userIds[0],
      category: "ice_halo" as const,
      region: "黑龙江",
      hasLocation: true,
      images: [HALO_IMAGES[0]],
      isArticle: false,
      isFeatured: true,
      viewCount: 723,
    },
    {
      title: "月晕与夜景的绝美组合",
      content: "<p>满月之夜拍到的月晕，虽然没有日晕那么明亮，但在夜空背景下别有一番韵味。周围还有几缕薄云环绕，增添了神秘感。</p><p>月晕通常预示着天气变化，老话说的'月晕而风'确实有科学依据。</p>",
      authorId: userIds[1],
      category: "ice_halo" as const,
      region: "上海",
      hasLocation: true,
      images: [],
      isArticle: false,
      isFeatured: false,
      viewCount: 234,
    },
    // Rainbow posts
    {
      title: "双彩虹横跨香港维多利亚港",
      content: "<p>暴雨过后在维多利亚港拍到了双彩虹！主彩虹色彩鲜艳，副彩虹在上方颜色较淡。这种双彩虹的形成需要光线在水滴中经过两次反射。</p><p>拍摄地点：太平山顶观景台</p>",
      authorId: userIds[2],
      category: "rainbow" as const,
      region: "香港",
      hasLocation: true,
      images: [RAINBOW_IMAGES[0], RAINBOW_IMAGES[1]],
      isArticle: false,
      isFeatured: true,
      viewCount: 1245,
    },
    {
      title: "如何预测和拍摄彩虹：一篇实用指南",
      content: "<h2>一、彩虹的形成原理</h2><p>彩虹是阳光通过空气中的水滴折射、反射后形成的光学现象。光线在水滴内发生一次反射形成主彩虹，两次反射形成副彩虹。</p><h2>二、预测彩虹的方法</h2><p>1. 雨后初晴时分最容易出现彩虹</p><p>2. 太阳高度角在40度以下时最容易观测</p><p>3. 背对太阳，面向雨区</p><h2>三、拍摄技巧</h2><p>1. 使用偏振镜可以增强彩虹的色彩饱和度</p><p>2. 使用广角镜头捕捉完整的彩虹弧线</p><p>3. 曝光补偿+0.5到+1档</p>",
      authorId: userIds[0],
      category: "rainbow" as const,
      region: "浙江",
      hasLocation: true,
      images: [RAINBOW_IMAGES[1]],
      isArticle: true,
      isFeatured: true,
      viewCount: 2103,
    },
    // Glory posts
    {
      title: "飞机上拍到的宝光（Glory）",
      content: "<p>从成都飞往拉萨的航班上，透过舷窗拍到了宝光！这是阳光照射到云层上，经由水滴衍射形成的光环现象。自己的飞机影子正好在光环中心，非常壮观。</p>",
      authorId: userIds[1],
      category: "glory" as const,
      region: "四川",
      hasLocation: true,
      images: [GLORY_IMAGES[0]],
      isArticle: false,
      isFeatured: false,
      viewCount: 445,
    },
    // Other posts
    {
      title: "川西高原的星空银河",
      content: "<p>在新都桥拍到的银河全景，海拔3500米的高原空气稀薄透明度高，是拍摄星空的绝佳地点。夏季银河从南方地平线升起，横跨整个夜空。</p><p>拍摄参数：ISO 3200, f/2.8, 25秒</p>",
      authorId: userIds[2],
      category: "sky_color" as const,
      region: "四川",
      hasLocation: true,
      images: [OTHER_IMAGES[0]],
      isArticle: false,
      isFeatured: false,
      viewCount: 1567,
    },
    {
      title: "罕见的气象奇观：乳状云",
      content: "<p>在新疆拍到了极为罕见的乳状云（Mammatus Clouds），这种云如同天空垂下的无数乳房状袋囊，通常出现在强雷暴云的底部。亲眼目睹真的令人敬畏大自然的力量。</p>",
      authorId: userIds[0],
      category: "sky_color" as const,
      region: "新疆",
      hasLocation: true,
      images: [OTHER_IMAGES[1]],
      isArticle: false,
      isFeatured: true,
      viewCount: 1876,
    },
    {
      title: "英仙座流星雨极大夜",
      content: "<p>英仙座流星雨极大夜在青海茶卡盐湖附近拍摄，肉眼每小时可见50-60颗流星。这种天象每年8月都会出现，是北半球三大流星雨之一。</p><p>最佳观测时间：凌晨1点到天亮前</p>",
      authorId: userIds[1],
      category: "sky_color" as const,
      region: "青海",
      hasLocation: true,
      images: [OTHER_IMAGES[2]],
      isArticle: true,
      isFeatured: false,
      viewCount: 2341,
    },
  ];

  const postIds: number[] = [];
  for (const post of posts) {
    const [{ id }] = await db.insert(schema.posts).values(post).$returningId();
    postIds.push(id);
    console.log(`Created post: ${post.title} (ID: ${id})`);
  }

  // Create comments
  const comments = [
    {
      postId: postIds[0],
      authorId: userIds[1],
      content: "太壮观了！我也在北京，可惜今天没看到。",
    },
    {
      postId: postIds[0],
      authorId: userIds[2],
      content: "积雨云的砧状结构真的很美，这是强对流的表现。",
    },
    {
      postId: postIds[3],
      authorId: userIds[0],
      content: "幻日也太清晰了吧！我在东北待了好几年都没见过这么明显的。",
    },
    {
      postId: postIds[5],
      authorId: userIds[0],
      content: "香港的双彩虹！太羡慕了，副彩虹的颜色顺序是反的吧？",
    },
    {
      postId: postIds[5],
      authorId: userIds[1],
      content: "是的，副彩虹颜色顺序与主彩虹相反，而且颜色较淡。",
    },
    {
      postId: postIds[6],
      authorId: userIds[2],
      content: "非常实用的指南！收藏了，下次拍彩虹用得上。",
    },
    {
      postId: postIds[8],
      authorId: userIds[0],
      content: "新都桥确实拍星空的好地方，光污染很少。",
    },
    {
      postId: postIds[9],
      authorId: userIds[1],
      content: "乳状云看起来非常震撼，像电影里的末日场景一样。",
    },
  ];

  for (const comment of comments) {
    await db.insert(schema.comments).values(comment);
    console.log(`Created comment on post ${comment.postId}`);
  }

  // Generate TEST_ACCOUNTS.md
  const mdLines = [
    "# 测试账号",
    "",
    "> ⚠️ 本文件包含系统初始化的测试账号及密码，请妥善保管，使用后请及时删除或修改密码。",
    "",
    "| 昵称 | 邮箱 | 密码 | 角色 |",
    "|------|------|------|------|",
    ...accountRecords.map((u) => `| ${u.name} | ${u.email} | ${u.password} | ${u.role === "admin" ? "管理员" : "普通用户"} |`),
    "",
    "## 使用说明",
    "",
    "- 以上账号仅在数据库为空时由 seed 脚本自动创建",
    "- 密码为随机生成，每次运行 seed 都会不同",
    "- 登录地址：`/login`",
    "- 管理员拥有设为精选、删除任意内容等权限",
    "",
  ];
  const mdPath = path.resolve(__dirname, "..", "TEST_ACCOUNTS.md");
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf-8");

  console.log("\n========================================");
  console.log("Seed complete!");
  console.log(`  Users: ${userIds.length}`);
  console.log(`  Posts: ${postIds.length}`);
  console.log(`  Comments: ${comments.length}`);
  console.log(`\n  Test accounts saved to: ${mdPath}`);
  console.log("========================================");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
