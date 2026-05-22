# syntax=docker/dockerfile:1

# ========== 第一阶段：构建前端 ==========
FROM node:20-slim AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存层
COPY package.json package-lock.json* ./

# 设置 npm 镜像源为华为源（避免 npmmirror 502 错误）
RUN npm config set registry https://repo.huaweicloud.com/repository/npm/
RUN npm ci && npm install

# 复制源码并构建
COPY . .
RUN npm run build

# ========== 第二阶段：生产运行 ==========
FROM node:20-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

# 更换为阿里云镜像源（国内服务器加速）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

# 安装系统级 libheif + HEVC 解码器（heif-convert 转换用）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif-examples libde265-0 \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制完整 node_modules（包含 drizzle-kit 等数据库迁移工具）
COPY --from=builder /app/node_modules ./node_modules

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/contracts ./contracts
COPY --from=builder /app/api ./api
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts

# 创建上传目录
RUN mkdir -p /app/dist/public/uploads

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/trpc/ping',(r)=>{process.exit(r.statusCode===200?0:1)})"

EXPOSE 3000

# 启动命令
CMD ["node", "dist/boot.js"]