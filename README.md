# AcomOfferDesk

AcomOfferDesk - веб-платформа для работы с заявками и офферами между сотрудниками и контрагентами, с интеграцией Telegram, Keycloak и уведомлений.

## Быстрые ссылки

- Инструкция по автопривязке пользователей к Keycloak: [docs/keycloak-autolink.md](docs/keycloak-autolink.md)
- Правила входа по внешним ссылкам (Telegram/email): [docs/login-links.md](docs/login-links.md)
- Развертывание БД `order_database` на VPS: [docs/order-database-vps.md](docs/order-database-vps.md)
- Типовые проблемы на VPS: [docs/vps-troubleshooting.md](docs/vps-troubleshooting.md)

## Архитектура

```text
Браузер / Telegram
        |
        v
   gateway (Nginx, :8080)
     |        |        |
     |        |        +--> /iam/* --> keycloak
     |        |
     |        +--> / --> web (React SPA)
     |
     +--> /api/* --> backend (FastAPI)
                      |            |
                      |            +--> RabbitMQ --> notifications_worker
                      |
                      +--> PostgreSQL (external: order_database)
                      +--> MinIO (S3-совместимое хранилище)

tg_bot <--> backend (/api/v1/tg/*)
```

## Технологии

- Backend: FastAPI, SQLAlchemy, Pydantic, aio-pika
- Frontend: React 18, TypeScript, Vite, MUI, React Hook Form, Zod
- IAM: Keycloak (OIDC Authorization Code + PKCE)
- Инфраструктура: Docker Compose, Nginx, RabbitMQ, MinIO, PostgreSQL
- Telegram: aiogram

## Структура репозитория

```text
backend/               FastAPI API, бизнес-логика, IAM-интеграция, WebSocket
web/                   React SPA (страницы, фичи, API-клиент)
tg_bot/                Telegram-бот
notifications_worker/  Воркер отправки email/TG уведомлений
infra/keycloak/        bootstrap и тема Keycloak
docs/                  Техническая документация
scripts/               Вспомогательные скрипты для серверов/БД
docker-compose.yml     Основной runtime compose
docker-compose.init.yml
                       Одноразовые init-задачи Keycloak
```

Важно: рабочая PostgreSQL схема находится в отдельном репозитории `order_database`. Этот проект подключается к уже поднятой БД через `DATABASE_URL`.

## Роли и статусы

ID ролей (`users.id_role`):

- `1` - superadmin
- `2` - admin
- `3` - contractor
- `4` - project_manager
- `5` - lead_economist
- `6` - economist
- `7` - operator

Статусы пользователя (`users.status`):

- `review`
- `active`
- `inactive`
- `blacklist`

Доступ к бизнес-функциям есть только при статусе `active`.

## Локальный запуск

### 1) Требования

- Docker Engine
- Docker Compose v2 (`docker compose`)
- Внешняя Docker-сеть `project_net`

Проверка:

```bash
docker --version
docker compose version
docker network create project_net
```

### 2) Подготовка переменных окружения

Создайте файлы из шаблонов:

- `compose.env.example` -> `.env`
- `backend/env.example` -> `backend/.env`
- `tg_bot/env.example` -> `tg_bot/.env`

Linux/macOS:

```bash
cp compose.env.example .env
cp backend/env.example backend/.env
cp tg_bot/env.example tg_bot/.env
```

PowerShell:

```powershell
Copy-Item compose.env.example .env
Copy-Item backend/env.example backend/.env
Copy-Item tg_bot/env.example tg_bot/.env
```

Обязательные блоки в `backend/.env`:

- `DATABASE_URL` (на `order_database`)
- `KEYCLOAK_*` (realm, client, admin bootstrap)
- `PUBLIC_BACKEND_BASE_URL`, `WEB_BASE_URL`
- SMTP (`EMAIL_*`, `SMTP_*`) для email-верификации/сброса пароля
- S3/MinIO (`S3_*`)

### 3) Первый запуск на чистом окружении

1. Поднимите PostgreSQL в репозитории `order_database`.
2. Подготовьте схему Keycloak:

```bash
docker compose -f docker-compose.init.yml up keycloak_db_prepare
```

3. Поднимите runtime:

```bash
docker compose up -d --build
```

4. Выполните bootstrap Keycloak:

```bash
docker compose -f docker-compose.init.yml up keycloak_bootstrap
```

### 4) Повторный запуск

```bash
docker compose up -d --build
```

Точки доступа:

- Приложение: `http://localhost:8080`
- API: `http://localhost:8080/api/v1/...`
- Keycloak (через gateway): `http://localhost:8080/iam`
- RabbitMQ UI: `http://localhost:15672`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Внешний доступ (туннели)

Для внешних проверок можно использовать профиль `tunnel`:

```bash
docker compose --profile tunnel up -d localtunnel
```

После перезапуска туннеля URL меняется. Нужно обновить URL в:

- `backend/.env` (`PUBLIC_BACKEND_BASE_URL`, `WEB_BASE_URL`)
- `tg_bot/.env` (`PUBLIC_BACKEND_BASE_URL`)

И пересоздать контейнеры:

```bash
docker compose up -d --force-recreate backend tg_bot
```

## Регистрация и вход: актуальные сценарии

### 1) Контрагент регистрируется самостоятельно (через Telegram/email invite)

1. Пользователь получает регистрацию по ссылке `/api/v1/auth/oidc/register?...`.
2. Проходит регистрацию в Keycloak и подтверждает email (если включено `KEYCLOAK_VERIFY_EMAIL=true`).
3. После callback backend создает локального пользователя с ролью `contractor`, статусом `review` и привязкой в `user_auth_accounts`.
4. Контрагент заполняет профиль/контакты в `/account`.
5. Superadmin (или ответственный админ) переводит `users.status` в `active`.
6. После этого контрагент получает полноценный бизнес-доступ.

### 2) Создание сотрудника (админка/API)

Создание идет через:

- UI: раздел "Пользователи" -> "Добавить пользователя"
- API: `POST /api/v1/users/register`

Что происходит:

1. Создается локальный пользователь в `users/profiles`.
2. Backend сразу создает/обновляет одноименный аккаунт в Keycloak (`KeycloakAdminService.ensure_user`).
3. Для сотрудника задается пароль из формы создания.
4. На первом входе через `/login` выполняется auto-link:
   - dev: по `username == users.id`
   - prod: по подтвержденному `email_verified=true` и уникальному email

### 3) Если это контрагент, созданный вручную

Это отдельный сценарий, который часто путают.

1. Контрагента создает сотрудник с правами создания пользователей (например, администратор или экономист) через `POST /api/v1/users/manual-contractor` (или UI).
2. Пользователь создается сразу со статусом `active` и ролью `contractor`.
3. В Keycloak создается аккаунт с этим `username`, но пароль не задается через AcomOfferDesk.
4. Для первого входа контрагент должен:
   - открыть `/login`,
   - нажать `Forgot Password` на форме Keycloak,
   - задать пароль через письмо на email.

Важно:

- У контрагента, созданного вручную, обязательно должен быть валидный email (обычно `company_mail`), иначе восстановление пароля не сработает.
- Прямая смена пароля через API AcomOfferDesk отключена: `PATCH /api/v1/users/{id}/manual-contractor` с полем `password` вернет ошибку.
- Прямой вход из Telegram отключен (`/auth/tg/login` только перенаправляет на обычный вход, `/api/v1/auth/tg/exchange` запрещен).

## Как устроена аутентификация

- Web UI использует только OIDC-вход через Keycloak.
- `access_token` хранится в памяти SPA.
- refresh-токен хранится в `HttpOnly` cookie.
- При загрузке SPA идет `POST /api/v1/auth/refresh` для восстановления сессии.
- При неактивном статусе пользователь направляется в `/account`, а не в рабочие разделы.

## Полезные команды

Логи:

```bash
docker compose logs -f
docker compose logs -f backend web gateway keycloak tg_bot notifications_worker
```

Пересоздать конкретные сервисы:

```bash
docker compose up -d --force-recreate backend tg_bot gateway
```

Остановка:

```bash
docker compose down
docker compose down -v
```

## Как дополнять проект

Типовой путь для новой backend-фичи:

1. Добавить/обновить схемы (`backend/app/schemas`).
2. Добавить логику в `backend/app/services`.
3. Добавить доступ к данным в `backend/app/repositories`.
4. Подключить endpoint в `backend/app/api/v1`.
5. Проверить права в `backend/app/domain/permissions.py` и `policies.py`.

Типовой путь для фронтенда:

1. Добавить API-метод в `web/src/shared/api`.
2. Добавить/обновить фичу в `web/src/features`.
3. Подключить страницу/роут в `web/src/pages` и `web/src/app/routes/AppRoutes.tsx`.

При изменении auth/ролей/регистрации обязательно обновляйте:

- `README.md`
- `docs/keycloak-autolink.md`
- `docs/login-links.md`
