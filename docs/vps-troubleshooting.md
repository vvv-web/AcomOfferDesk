# VPS: типовые сбои (кратко)

Полный журнал с контекстом: в **`devops_manual`** — [acom-offer-desk-archive/vps-troubleshooting-2026-03.md](https://github.com/vvv-web/devops_manual/blob/main/docs/acom-offer-desk-archive/vps-troubleshooting-2026-03.md) (ветка с документом).

## 502 / «сервер недоступен» после `docker compose up --force-recreate backend`

**Причина:** контейнер **`gateway`** (nginx) продолжает проксировать на **старый IP** `backend` в Docker-сети.

**Исправление:**

```bash
cd /opt/acome-offer-desk
docker compose up -d --force-recreate --no-deps gateway
```

Скрипт **`scripts/install-order-database-vps.sh`** после обновления **`DATABASE_URL`** пересоздаёт **`backend`**, **`notifications_worker`** и **`gateway`**.

## Почта не уходит

**Не задавать** **`SMTP_HOST=127.0.0.1`** в **`backend/.env`** для контейнеров — это не хост VPS. Для Яндекса: **`smtp.yandex.com`**, порт **465**, затем **`docker compose up -d --force-recreate backend notifications_worker`**.

## Superadmin после пересоздания БД

Пароль на VPS (root): **`/root/.acom_order_db_superadmin_password`**.

## `.env`

Не дублировать **`WEB_BASE_URL`** / **`PUBLIC_BACKEND_BASE_URL`**. **`tg_bot/.env`** — только ключи из **`tg_bot/env.example`**, не копия **`backend/.env`**.
