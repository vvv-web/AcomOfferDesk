# VPS: типовые сбои (кратко)

Полный журнал с контекстом: **`vvv-web/devops_manual`** — [docs/acom-offer-desk-archive/vps-troubleshooting-2026-03.md](https://github.com/vvv-web/devops_manual/blob/acom-offer-postgres-vps-2026-03-31/docs/acom-offer-desk-archive/vps-troubleshooting-2026-03.md).

---

## 502 / «сервер недоступен» после `docker compose up --force-recreate backend`

**Причина:** контейнер **`gateway`** (nginx) продолжает проксировать на **старый IP** `backend` в Docker-сети.

**Исправление:**

```bash
cd /opt/acome-offer-desk
docker compose up -d --force-recreate --no-deps gateway
```

Скрипт **`scripts/install-order-database-vps.sh`** после обновления **`DATABASE_URL`** пересоздаёт **`backend`**, **`notifications_worker`** и **`gateway`**.

**На будущее:** в `nginx.conf` шлюза — **`resolver 127.0.0.11`** и **`proxy_pass` через переменную**, чтобы имя **`backend`** резолвилось заново.

---

## Чат (WebSocket): с домена не работает, с IP:8080 — работает

Внутренний nginx в **`gateway`** уже пробрасывает **`Upgrade`** для **`/api/`**. Если **`wss://домен/api/v1/ws/chat`** не подключается (часто **404** на handshake), а **`ws://IP:8080/...?token=…`** даёт **`connection.ready`** — чинить **хостовый** nginx/TLS **перед** Docker.

**Проверенный патч на хосте (Debian/Ubuntu):**

1. Файл **`/etc/nginx/conf.d/ws-upgrade-map.conf`:**

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

2. В **`server { … }`** для домена, в **`location /api/`** (рядом с **`proxy_pass`**):

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_read_timeout 86400;
```

Затем **`nginx -t && systemctl reload nginx`**.

---

## Почта не уходит

**Не задавать** **`SMTP_HOST=127.0.0.1`** в **`backend/.env`** для контейнеров — это не хост VPS. Для Яндекса: **`smtp.yandex.com`**, порт **465**, затем **`docker compose up -d --force-recreate backend notifications_worker`** (при необходимости и **`gateway`**).

Если в логах **`notifications_worker`** — **`SMTPAuthenticationError: 535`** — проверьте **`EMAIL_ADDRESS`**: реальный ящик (например **`@yandex.ru`**), не **`noreply@localhost`**, и **`EMAIL_APP_PASSWORD`** — пароль приложения для этого ящика.

Если в логах **`backend`** про отключённый IMAP — задать **`IMAP_HOST`**, **`IMAP_PORT`** по **`backend/env.example`**.

---

## Superadmin после пересоздания БД

Пароль задаётся при инициализации **`order_database`**. На VPS (root): **`/root/.acom_order_db_superadmin_password`**. Пароли из старых заметок после нового тома могут не совпадать.

---

## `.env`

- Не дублировать **`WEB_BASE_URL`** / **`PUBLIC_BACKEND_BASE_URL`** / **`TG_LINK_SECRET`**.
- **`tg_bot/.env`** — только ключи из **`tg_bot/env.example`**, не копия **`backend/.env`**.
- **`DATABASE_URL`:** хост Postgres = имя сервиса в вашей Docker-сети (часто **`order-database-postgres`**).
- Публичные URL — **ваш** домен/туннель.
