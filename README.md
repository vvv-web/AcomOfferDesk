# AcomOfferDesk

AcomOfferDesk - внутренняя веб-платформа для работы с заявками и офферами между сотрудниками компании и контрагентами. Проект объединяет единый web-интерфейс, backend API, интеграцию с Keycloak, email-уведомления, чат по офферам и инфраструктурные сервисы для хранения файлов и обмена событиями.

## Для кого этот README

Этот файл - верхнеуровневая точка входа в проект. Он помогает:

- быстро понять назначение продукта;
- увидеть состав системы и ключевые зависимости;
- поднять проект локально;
- перейти к детальной документации по архитектуре, потокам данных и разработке.

Если нужна более глубокая документация, начните с:

- [Обзор проекта и бизнес-логики](docs/project-overview.md)
- [Архитектура и потоки данных](docs/runtime-architecture.md)
- [Навигация для разработчика](docs/developer-guide.md)
- [Автопривязка пользователей к Keycloak](docs/keycloak-autolink.md)
- [Правила входа по внешним ссылкам](docs/login-links.md)
- [Развертывание `order_database` на VPS](docs/order-database-vps.md)
- [Типовые проблемы на VPS](docs/vps-troubleshooting.md)

## Что делает система

Основной сценарий продукта:

1. Сотрудник создает заявку на закупку или запрос.
2. Контрагенты получают доступ к заявке и формируют офферы.
3. Сотрудники сравнивают офферы, общаются с контрагентами в рабочем пространстве оффера и принимают решение.
4. Система управляет доступом по ролям, статусам пользователей, уведомлениям и файловыми вложениями.

Дополнительно проект покрывает:

- регистрацию и вход через Keycloak;
- приглашение контрагентов по email-ссылкам;
- ручное создание контрагентов и сотрудников;
- доставку email-уведомлений;
- чат в рамках оффера;
- хранение файлов в S3-совместимом хранилище;
- legacy-путь через Telegram-бота, который сейчас отключен по умолчанию.

## Состав системы

```text
Browser
   |
   v
gateway (Nginx, :8080)
  |-- /           -> web (React SPA)
  |-- /api/*      -> backend (FastAPI)
  |-- /iam/*      -> keycloak
  |
  +-> backend также работает с:
      - PostgreSQL (external order_database)
      - RabbitMQ
      - MinIO
      - notifications_worker

legacy tg_bot <-> backend (/api/v1/tg/*), disabled by default
```

## Технологический стек

### Application

- `backend`: FastAPI, SQLAlchemy 2, Pydantic, aio-pika
- `web`: React 18, TypeScript, Vite, MUI, React Hook Form, Zod
- `notifications_worker`: Python worker для email-уведомлений
- `tg_bot`: aiogram, legacy-модуль

### Platform

- `Keycloak` для OIDC / IAM
- `PostgreSQL` в отдельном репозитории `order_database`
- `RabbitMQ` для очередей и событий
- `MinIO` для файлов
- `Nginx` как единая точка входа
- `Docker Compose` для локального и серверного runtime

## Структура репозитория

```text
backend/               FastAPI API, бизнес-логика, IAM, realtime, файлы
web/                   React SPA
notifications_worker/  Воркер отправки email-уведомлений
tg_bot/                Legacy Telegram-бот
infra/keycloak/        Импорт realm, bootstrap и тема Keycloak
docs/                  Проектная и эксплуатационная документация
scripts/               Вспомогательные серверные и deploy-скрипты
shared/                Общие артефакты для контейнеров
docker-compose.yml     Основной runtime compose
docker-compose.init.yml
                       Инициализационные задачи Keycloak
```

Подробнее по внутренней структуре модулей: [docs/developer-guide.md](docs/developer-guide.md).

## Ключевые бизнес-сущности

### Пользователи и роли

Роли (`users.id_role`):

- `1` - `superadmin`
- `2` - `admin`
- `3` - `contractor`
- `4` - `project_manager`
- `5` - `lead_economist`
- `6` - `economist`
- `7` - `operator`

Статусы пользователя (`users.status`):

- `review`
- `active`
- `inactive`
- `blacklist`

Бизнес-доступ к рабочим разделам получают только пользователи со статусом `active`.

### Заявки и офферы

- `request` - исходная заявка сотрудника
- `offer` - предложение контрагента по заявке
- `offer workspace` - рабочее пространство оффера: детали заявки, оффера, контрагента и чат
- `files` - вложения к заявкам, офферам и сообщениям

## Как устроен вход и доступ

Проект использует только OIDC-поток через Keycloak для web-приложения.

- SPA инициирует login redirect.
- Backend обрабатывает OIDC callback.
- `access_token` используется на frontend.
- `refresh_token` хранится в `HttpOnly` cookie.
- При загрузке SPA выполняется `POST /api/v1/auth/refresh`.
- После входа backend синхронизирует Keycloak identity с локальными пользователями.

Подробности:

- [Автопривязка пользователей к Keycloak](docs/keycloak-autolink.md)
- [Правила входа по внешним ссылкам](docs/login-links.md)
- [Архитектура и потоки данных](docs/runtime-architecture.md)

## Быстрый старт локально

### 1. Требования

- Docker Engine
- Docker Compose v2
- внешняя Docker-сеть `project_net`
- доступ к рабочей БД из репозитория `order_database`

Проверка:

```bash
docker --version
docker compose version
docker network create project_net
```

### 2. Подготовка переменных окружения

Создайте файлы окружения из шаблонов:

Linux/macOS:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Минимально проверьте в корневом `.env`:

- `DATABASE_URL`
- `KEYCLOAK_*`
- `PUBLIC_BACKEND_BASE_URL`
- `WEB_BASE_URL`
- `SMTP_*` / `EMAIL_*`
- `S3_*`

### 3. Первый запуск на чистом окружении

1. Поднимите PostgreSQL в репозитории `order_database`.
2. Подготовьте схему Keycloak:

```bash
docker compose -f docker-compose.init.yml up keycloak_db_prepare
```

3. Поднимите основной стек:

```bash
docker compose up -d --build
```

4. Выполните bootstrap Keycloak:

```bash
docker compose -f docker-compose.init.yml up keycloak_bootstrap
```

### 4. Повторный запуск

```bash
docker compose up -d --build
```

### 5. Точки доступа

- приложение: `http://localhost:8080`
- API: `http://localhost:8080/api/v1/...`
- Keycloak: `http://localhost:8080/iam`
- RabbitMQ UI: `http://localhost:15672`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Частые команды

Запуск:

```bash
docker compose up -d --build
```

Логи:

```bash
docker compose logs -f
docker compose logs -f backend web gateway keycloak notifications_worker
```

Пересоздание сервисов:

```bash
docker compose up -d --force-recreate backend gateway
```

Остановка:

```bash
docker compose down
docker compose down -v
```

## Внешний доступ для проверок

Для временного внешнего доступа можно использовать профиль `tunnel`:

```bash
docker compose --profile tunnel up -d localtunnel
```

После смены публичного URL нужно обновить:

- `.env` -> `PUBLIC_BACKEND_BASE_URL`
- `.env` -> `WEB_BASE_URL`

И затем пересоздать backend:

```bash
docker compose up -d --force-recreate backend
```

## Что читать дальше

Если вы:

- знакомитесь с продуктом, начните с [docs/project-overview.md](docs/project-overview.md)
- разбираетесь в контейнерах, auth и интеграциях, откройте [docs/runtime-architecture.md](docs/runtime-architecture.md)
- хотите быстро ориентироваться в кодовой базе, смотрите [docs/developer-guide.md](docs/developer-guide.md)
- меняете auth, роли или регистрацию, обязательно проверьте `README.md`, `docs/keycloak-autolink.md` и `docs/login-links.md`

## Environment and Perimeter

For the current environment split and perimeter rules, use:

- [docs/environments.md](docs/environments.md)
- [docs/network-perimeter.md](docs/network-perimeter.md)
- [docs/admin-access.md](docs/admin-access.md)

Для локальной разработки нормальным сценарием считается использование `ngrok`,
если нужно, чтобы email-ссылки, OIDC redirect/callback и другие внешние переходы
сразу работали с корректным публичным HTTPS URL. Подробности и команды запуска
описаны в [docs/environments.md](docs/environments.md).
