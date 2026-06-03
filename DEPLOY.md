# 天象志部署指南

## 默认部署模式

当前默认使用 Docker Compose 内置 MySQL，`docker-compose.yml` 会启动：

- `app`：Hono/tRPC + Vite 构建后的应用，宿主机调试端口 `3000`
- `db`：MySQL 8.0，宿主机端口 `3306`
- `nginx`：反向代理，宿主机端口 `80`

生产暂不使用阿里云 RDS。以后如果重新切回外部数据库，只需要把 `.env.local` 的 `DATABASE_URL` 指向外部 MySQL，并按需移除 compose 里的 `db` 服务。

## 环境变量

```bash
cp .env.local.example .env.local
nano .env.local
```

本地 MySQL 默认示例：

```env
APP_SECRET=至少32位随机密钥

MYSQL_ROOT_PASSWORD=强root密码
MYSQL_DATABASE=skyweb
MYSQL_USER=skyweb
MYSQL_PASSWORD=强应用密码
DATABASE_URL=mysql://skyweb:强应用密码@db:3306/skyweb

EMAIL_AUTH_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=no-reply@example.com
SMTP_PASS=邮箱授权码或应用密码
SMTP_FROM="天象志 <no-reply@example.com>"

ALIYUN_CAPTCHA_SCENE_ID=阿里云验证码场景ID
ALIYUN_CAPTCHA_PREFIX=阿里云验证码身份标
ALIYUN_CAPTCHA_REGION=cn
# ALIYUN_CAPTCHA_REGION 只能填 cn 或 sgp；需要双栈或自定义 endpoint 时再配置下一行。
# ALIYUN_CAPTCHA_ENDPOINT=captcha-dualstack.cn-shanghai.aliyuncs.com
ALIBABA_CLOUD_ACCESS_KEY_ID=RAM用户AccessKeyId
ALIBABA_CLOUD_ACCESS_KEY_SECRET=RAM用户AccessKeySecret

COMMENT_BLOCKLIST=词1,词2
COOKIE_SAMESITE=Lax
```

阿里云验证码请使用 RAM 用户 AccessKey，不要使用主账号 AccessKey；该 RAM 用户至少需要验证码服务调用权限，建议授予 `AliyunYundunAFSFullAccess`。
如果暂时没有配置阿里云验证码，网站会正常启动，但注册和找回密码的“发送验证码”会被禁用或返回“验证码服务未配置”；可临时设置 `EMAIL_AUTH_ENABLED=false` 关闭邮箱验证码入口。

`COMMENT_BLOCKLIST` 使用英文逗号分隔。可选 `COMMENT_BLOCK_PATTERNS` 支持简单正则，命中后评论会被拒发且不会保存。

## 首次部署

```bash
cd /opt/TXtest
docker compose up -d --build
docker compose ps
docker compose exec app npx drizzle-kit push
docker compose exec app node scripts/seed-admin.js
curl -i http://127.0.0.1/
```

`scripts/seed-admin.js` 会创建第一个超级管理员：

- 不需要邮箱验证码。
- 邮箱会绑定到账号。
- 外显用户 ID 固定为 `100001`。
- 角色为 `super_admin`，等级为 `L99`。

超级管理员登录后，在 `/admin/users` 添加管理员邮箱预授权。被添加邮箱的用户自行注册并通过邮箱验证码后，会自动成为 `admin/L99`。未匹配预授权邮箱的注册用户为 `user/L0`，普通用户只开放评论权限。

如果是从旧库迁移，先执行 schema 同步，再执行账号回填：

```bash
docker compose exec app npx drizzle-kit push
docker compose exec app node scripts/backfill-account-ids.js
```

## 更新部署

```bash
cd /opt/TXtest
git pull
docker compose up -d --build
docker compose exec app npx drizzle-kit push
docker compose ps
docker compose logs --tail=80 app
curl -i http://127.0.0.1/
```

## 常用排查

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f db
docker compose logs -f nginx
docker compose exec app npx drizzle-kit push
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1/
```

如果容器无法启动，重点检查：

- `APP_SECRET` 是否至少 32 位。
- `DATABASE_URL` 是否使用 `@db:3306`，并且 `MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE` 一致。
- 服务器 80、3000、3306 端口是否被其他服务占用。
- SMTP 和阿里云验证码配置是否完整。
- 如配置 `ALLOWED_ORIGINS`，必须与浏览器访问的 origin 完全一致。

## 数据持久化

- 用户上传文件挂载在宿主机 `./uploads`。
- MySQL 数据保存在 Docker volume `mysql-data`。
- 容器重建不会删除上传文件或数据库数据；执行 `docker compose down -v` 才会删除 MySQL volume。
