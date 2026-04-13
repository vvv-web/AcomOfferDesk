# Backend (`/backend`)

Основной API и бизнес-логика AcomOfferDesk.

## Стек

- FastAPI
- SQLAlchemy 2
- Pydantic / pydantic-settings
- aio-pika (RabbitMQ)
- MinIO SDK
- Интеграция с Keycloak (OIDC + Admin API)

## Основные директории

```text
app/
  api/v1/            REST и WS endpoints
  services/          бизнес-слой (users, auth, requests, offers, ...)
  repositories/      доступ к БД
  domain/            permissions/policies/exceptions
  schemas/           pydantic-схемы API
  infrastructure/    DB, email, S3, publisher
  realtime/          runtime WebSocket-чата
  core/              конфиг, токены, UoW, security
```

## Внешние зависимости

- PostgreSQL (из репозитория `order_database`)
- RabbitMQ
- MinIO
- Keycloak

Все зависимости подключаются в `docker-compose.yml` из корня проекта.

## Маршрутизация через gateway

`backend/nginx.conf` определяет единый вход:

- `/api/*` -> `backend:8000`
- `/iam/*` -> `keycloak:8080/iam`
- `/` -> `web:80`

## Запуск

Рекомендуется запускать backend в составе корневого compose:

```bash
docker compose up -d --build
```

API после запуска:

- `http://localhost:8080/api/v1/...`

## Auth

- Основной вход: Keycloak (`/api/v1/auth/oidc/login`, `/api/v1/auth/callback`)
- Локальный password login через backend API не используется; вход выполняется через Keycloak.
- Прямой вход из Telegram отключен (`/api/v1/auth/tg/exchange` -> `Forbidden`)

## Полезно при разработке

- Конфиг читается из `backend/.env` (`app/core/config.py`).
- При изменении auth/ролей/регистрации синхронизируйте:
  - `README.md`
  - `docs/keycloak-autolink.md`
  - `docs/login-links.md`
