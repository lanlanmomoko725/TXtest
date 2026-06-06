# Skyweb2 Deployment Guide

## Default Deployment

The default deployment uses Docker Compose with local MySQL:

- `nginx`: public reverse proxy on host port `80`.
- `app`: Hono/tRPC + built Vite app, bound to `127.0.0.1:3000`.
- `db`: MySQL 8.0, bound to `127.0.0.1:3306`.

Only Nginx should be reachable from the public internet. In the cloud security group, open `80` and, after TLS is configured, `443`. Keep `3000` and `3306` closed to the public internet.

## Environment

```bash
cp .env.local.example .env.local
nano .env.local
```

Minimum production values:

```env
APP_SECRET=replace-with-random-secret-at-least-32-chars

MYSQL_ROOT_PASSWORD=replace-with-strong-root-password
MYSQL_DATABASE=skyweb
MYSQL_USER=skyweb
MYSQL_PASSWORD=replace-with-strong-app-password
DATABASE_URL=mysql://skyweb:replace-with-strong-app-password@db:3306/skyweb

EMAIL_AUTH_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=no-reply@example.com
SMTP_PASS=replace-with-app-password
SMTP_FROM="Skyweb <no-reply@example.com>"

ALIYUN_CAPTCHA_SCENE_ID=replace-with-scene-id
ALIYUN_CAPTCHA_PREFIX=replace-with-prefix
ALIYUN_CAPTCHA_REGION=cn
ALIBABA_CLOUD_ACCESS_KEY_ID=replace-with-ram-access-key-id
ALIBABA_CLOUD_ACCESS_KEY_SECRET=replace-with-ram-access-key-secret

SMS_AUTH_ENABLED=true
ALIYUN_SMS_SIGN_NAME=replace-with-system-sign-name
ALIYUN_SMS_TEMPLATE_CODE=100001
ALIYUN_SMS_TEMPLATE_PARAM={"code":"##code##","min":"5"}
ALIYUN_SMS_COUNTRY_CODE=86
ALIYUN_SMS_VALID_TIME_SECONDS=300
ALIYUN_SMS_INTERVAL_SECONDS=60

COOKIE_SAMESITE=Lax
```

Use an Alibaba Cloud RAM user for CAPTCHA. Do not use the root account AccessKey. `ALIYUN_CAPTCHA_REGION` must be `cn` or `sgp`; use `ALIYUN_CAPTCHA_ENDPOINT` only when a custom endpoint is required.

SMS verification uses Alibaba Cloud PNVS/Dypnsapi `SendSmsVerifyCode` and `CheckSmsVerifyCode`. The RAM user must be allowed to call these two actions. Keep the AccessKey in `.env.local` only. In production, enable HTTPS before opening registration because phone numbers, email addresses, and passwords must travel over TLS; phone numbers are encrypted at rest in MySQL and only a keyed hash is stored for lookup.

## First Deployment

```bash
cd /opt/TXtest
docker compose up -d --build
docker compose ps
docker compose exec app npx drizzle-kit push
docker compose exec app node scripts/seed-admin.js
curl -i http://127.0.0.1/
```

`scripts/seed-admin.js` creates the first super administrator:

- No email verification is required for the first account.
- The entered email is bound to the account.
- No SMS verification is required for this first super administrator.
- The public user ID is fixed as `100001`.
- The role is `super_admin` and the level is `L99`.

After logging in as the super administrator, add administrator email allowlist entries at `/admin/users`. Users register with phone SMS verification. If they optionally bind and verify an allowlisted email during registration, they become `admin/L99`; other users become `user/L0`.

For an existing database, sync the schema and then backfill account IDs:

```bash
docker compose exec app npx drizzle-kit push
docker compose exec app node scripts/backfill-account-ids.js
```

## Updating

```bash
cd /opt/TXtest
git pull
docker compose up -d --build
docker compose exec app npx drizzle-kit push
docker compose ps
docker compose logs --tail=80 app
curl -i http://127.0.0.1/
```

This version adds `sessions`, `rate_limit_buckets`, `security_events`, encrypted phone fields, and the `bind_email` verification purpose. Run `drizzle-kit push` after deploying the code.

## HTTPS

Production should use HTTPS. A common setup is to terminate TLS in Nginx or in the cloud provider load balancer, then redirect HTTP to HTTPS and enable HSTS.

Recommended Nginx additions after certificates are installed:

```nginx
return 301 https://$host$request_uri;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

When HTTPS is active, cookies are issued with `Secure` automatically because `X-Forwarded-Proto` is `https`.

## Small Server Builds

If the build appears stuck at `RUN npm run build`, use plain logs and BuildKit cache:

```bash
cd /opt/TXtest
DOCKER_BUILDKIT=1 docker compose build --progress=plain app
docker compose up -d --force-recreate app nginx
```

For 1-2GB RAM servers:

```bash
DOCKER_BUILDKIT=1 docker compose build --progress=plain --build-arg NODE_MAX_OLD_SPACE=512 app
```

## Security Checklist

- Public security group: allow only `80` and `443`.
- Confirm Compose does not expose `3000` or `3306` publicly: `docker compose ps`.
- Rotate `APP_SECRET`, SMTP password, MySQL passwords, SMS template credentials, and Aliyun RAM keys if they were ever committed or shared.
- Keep `.env.local` out of Git and out of images.
- Back up MySQL regularly:

```bash
docker compose exec db mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" > skyweb-$(date +%F).sql
```

- Back up `./uploads` together with the database.
- Review `/admin/audit` after suspicious activity; security rate-limit and filter events appear in the Security Events tab.

## Troubleshooting

```bash
docker compose ps
docker compose logs -f app
docker compose logs -f db
docker compose logs -f nginx
docker compose exec app npx drizzle-kit push
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1/
```

Check these first when containers fail:

- `APP_SECRET` is at least 32 characters.
- `DATABASE_URL` uses `@db:3306`, and MySQL user/password/database match `.env.local`.
- Host ports `80`, `3000`, and `3306` are not occupied by another service.
- SMTP settings are complete when email binding or password reset is enabled.
- Aliyun CAPTCHA and SMS settings are complete when public registration or SMS login is enabled.
- `ALLOWED_ORIGINS`, if set, exactly matches the browser origin.

## Persistence

- Uploaded files are mounted at host path `./uploads`.
- MySQL data is stored in Docker volume `mysql-data`.
- Recreating containers does not remove uploads or database data. `docker compose down -v` deletes the MySQL volume.
