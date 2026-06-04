# syntax=docker/dockerfile:1

FROM node:20-slim AS builder

WORKDIR /app

ARG NODE_MAX_OLD_SPACE=768
ENV NODE_OPTIONS=--max-old-space-size=${NODE_MAX_OLD_SPACE}

COPY package.json package-lock.json* ./

RUN npm config set registry https://repo.huaweicloud.com/repository/npm/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --fund=false --prefer-offline

COPY . .
RUN npm run build

FROM node:20-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

RUN apt-get update && apt-get install -y --no-install-recommends \
    libheif-examples libde265-0 \
    && rm -rf /var/lib/apt/lists/*

# Keep full node_modules because dist/boot.js externalizes package imports.
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/contracts ./contracts
COPY --from=builder /app/api ./api
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/dist/public/uploads

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/trpc/ping',(r)=>{process.exit(r.statusCode===200?0:1)})"

EXPOSE 3000

CMD ["node", "dist/boot.js"]
