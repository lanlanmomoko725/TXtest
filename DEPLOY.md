# 天象志 - Docker 部署指南

## 前置要求

- 一台云服务器（建议 2C4G 以上配置）
- 安装 Docker 和 Docker Compose
- 一个域名（可选，推荐配置）

## 安装 Docker（CentOS/Ubuntu）

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

## 部署方式一：使用内置 MySQL（快速开始）

### 1. 上传代码到服务器

```bash
# 方式 A：git 克隆
git clone <你的仓库地址> /opt/tianxiang
cd /opt/tianxiang

# 方式 B：直接上传 zip，解压
cd /opt/tianxiang
```

### 2. 配置环境变量

```bash
cp .env .env.local
# 编辑 .env.local，修改以下关键项：
# - DATABASE_URL=mysql://tianxiang:tianxiang456@db:3306/tianxiang
# - DB_ROOT_PASSWORD=你的root密码
# - DB_PASSWORD=你的数据库密码
```

如果 MySQL 用 docker-compose 里的内置服务，`DATABASE_URL` 填：
```
mysql://tianxiang:tianxiang456@db:3306/tianxiang
```
> `@db` 中的 `db` 是 docker-compose 中的服务名，Docker 会自动解析为容器 IP

### 3. 启动

```bash
docker compose up -d
```

首次启动会自动：
- 拉取 Node.js 和 MySQL 镜像
- 构建应用镜像
- 创建数据库
- 启动服务

### 4. 初始化数据库

```bash
# 进入应用容器执行数据库同步
docker compose exec app npx drizzle-kit push

# 如果需要填充测试数据
docker compose exec app npx tsx db/seed.ts
```

### 5. 访问

打开浏览器访问 `http://你的服务器IP:3000`

---

## 部署方式二：使用外部 MySQL（生产推荐）

如果你使用云数据库（如阿里云 RDS、TiDB Cloud），不需要启动内置 MySQL：

### 修改 docker-compose.yml

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: tianxiang-app
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    volumes:
      - ./uploads:/app/dist/public/uploads
    restart: unless-stopped
    # 删除 depends_on db
    networks:
      - tianxiang-network

  # 注释掉或删除 db 服务
  # db:
  #   ...

  # 可选：Nginx
  # nginx:
  #   ...

# 注释掉 volumes mysql-data
# volumes:
#   mysql-data:
```

`.env.local` 中的 `DATABASE_URL` 指向你的外部数据库地址即可。

---

## 常用运维命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f app          # 应用日志
docker compose logs -f db           # 数据库日志
docker compose logs -f --tail 100   # 最近 100 行

# 重启服务
docker compose restart app

# 停止所有服务
docker compose down

# 停止并删除数据卷（注意：会清空数据库！）
docker compose down -v

# 重新构建（代码更新后）
docker compose up -d --build

# 进入容器内部
docker compose exec app sh

# 备份数据库
docker compose exec db mysqldump -u root -p tianxiang > backup.sql

# 恢复数据库
docker compose exec -T db mysql -u root -p tianxiang < backup.sql
```

---

## 更新迭代流程

当代码有更新时，服务器上的操作只需 3 步：

```bash
cd /opt/tianxiang
git pull                    # 拉取最新代码
docker compose up -d --build # 重新构建并启动
```

全程约 2-3 分钟，零停机（Docker 先启动新容器再停止旧容器）。

---

## HTTPS 配置（推荐）

### 方式 A：Nginx + Let's Encrypt（免费证书）

```bash
# 在宿主机安装 certbot
docker run -it --rm \
  -v ./certbot-data:/etc/letsencrypt \
  -v ./nginx-data:/etc/nginx \
  certbot/certbot certonly --standalone -d your-domain.com

# 修改 nginx.conf 启用 SSL 端口 443
# 然后重启
docker compose restart nginx
```

### 方式 B：使用云服务商负载均衡

在阿里云/腾讯云控制台配置负载均衡 + HTTPS 证书，后端指向服务器的 3000 端口即可。

---

## 文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 应用镜像构建配置（多阶段构建，优化体积） |
| `docker-compose.yml` | 全栈编排（App + MySQL + Nginx） |
| `nginx.conf` | Nginx 反向代理配置 |
| `.env.local` | 环境变量（部署前需配置） |

---

## 数据持久化说明

以下数据会持久化到宿主机，容器重建不会丢失：

| 数据 | 宿主机路径 | 说明 |
|------|-----------|------|
| 用户上传的图片 | `./uploads` | 帖子图片、头像等 |
| MySQL 数据 | `mysql-data` Docker 卷 | 所有业务数据 |
| SSL 证书 | `./ssl` | HTTPS 证书文件 |

---

## 故障排查

```bash
# 容器启动失败，看详细日志
docker compose logs app --no-color

# 数据库连接不上
docker compose exec app sh -c 'npx drizzle-kit push'
# 检查 DATABASE_URL 是否正确

# 端口被占用
sudo lsof -i :3000
sudo systemctl stop nginx  # 如果宿主机有 Nginx 冲突

# 磁盘空间满了
docker system prune -a      # 清理未使用的镜像和容器
docker volume prune         # 清理未使用的数据卷
```

## 当前账号模式：管理员邀请制

当前部署暂不开放公开邮箱验证码注册，生产环境也不再要求配置 SMTP。首次部署时先创建初始管理员：

```bash
docker compose exec app node scripts/seed-admin.js
```

初始管理员登录后，通过 `/admin/users` 创建内部用户账号并分发初始密码。后续如需恢复邮箱验证码注册，再补充 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM` 并重新启用公开注册入口。

如果线上因为缺少 SMTP 配置导致旧容器启动失败，更新代码后执行：

```bash
docker compose up -d --build --force-recreate app nginx
docker compose logs --tail=80 app
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:81/
```
