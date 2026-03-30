# AcomOfferDesk — развёртывание через Docker Compose

Этот репозиторий можно поднять одной командой через корневой `docker-compose.yml`.

---

## ⚡ Обновлённая версия (дополнения для внешнего доступа)

Данная секция дополняет основной README с учётом проверенного развёртывания (февраль 2026).

**Что добавлено:**

- **Localtunnel** вместо ngrok (ngrok даёт ERR_NGROK_9040 при блокировке IP; localtunnel — рабочий вариант).
- **order_database** — отдельный compose с PostgreSQL; его нужно поднимать первым, создать сеть `project_net`.
- **Критично:** при перезапуске localtunnel URL меняется → обновить `PUBLIC_BACKEND_BASE_URL` и `WEB_BASE_URL` в `backend/.env` и `tg_bot/.env`, затем `docker compose up -d --force-recreate backend tg_bot` (restart не перечитывает .env).
- **Доступ с другого ПК:** после ввода Tunnel Password (публичный IP машины с туннелем) доступ по тому же URL.

**Шаблоны переменных окружения (этап перед `docker compose up`):**

| Файл | Назначение |
|------|------------|
| `compose.env.example` | Скопировать в **корневой** `.env` — подстановка для MinIO в `docker-compose.yml`. |
| `backend/env.example` | Скопировать в **`backend/.env`** — все переменные бэкенда (см. `backend/app/core/config.py`). |
| `tg_bot/env.example` | Скопировать в **`tg_bot/.env`** — токен бота и URL шлюза/API. |

Команды: `cp compose.env.example .env`, `cp backend/env.example backend/.env`, `cp tg_bot/env.example tg_bot/.env`, затем отредактировать значения (секреты не коммитить).

**Два бота в Telegram:** продуктовый **AcomOfferDesk** (тест/прод) и отдельный **DevOfferDesk** для разработки. На стенде **`test`** используйте токен и ссылки **AcomOfferDesk**, публичные URL своего хоста или туннеля — не подставляйте слепо dev-бота и чужой ngrok из чужих `.env`.

Подробная шпаргалка — в `docs/AcomOfferDesk_DEPLOYMENT_SUCCESS.md` (devops_manual).

**Кратко: шаги по ролям**

**Разворачивающий** — команды для поднятия:

```bash
# заменить /path/to/ на свои каталоги (например /home/user/acom-project/)

# 1. Сеть + order_database (PostgreSQL)
docker network create project_net
cd /path/to/order_database && docker compose up -d

# 2. AcomOfferDesk + localtunnel
cd /path/to/AcomOfferDesk && docker compose up -d --build
docker compose --profile tunnel up -d localtunnel

# 3. URL туннеля → обновить .env → пересоздать backend и tg_bot
docker logs localtunnel 2>&1 | grep "your url"
# Вписать URL в backend/.env и tg_bot/.env (PUBLIC_BACKEND_BASE_URL, WEB_BASE_URL)
docker compose up -d --force-recreate backend tg_bot

# 4. В веб-админке: Контрагенты → active, создать заявки
```

| Роль | Шаги |
|------|------|
| **Контрагент** | 1. Зарегистрироваться в @AcomOfferDeskBot. 2. Дождаться активации (сообщение «Доступ открыт»). 3. `/start` — увидеть заявки и ссылки. 4. Войти в веб по ссылке (логин/пароль с регистрации). |
| **Экономист** | 1. Получить логин/пароль от суперадмина. 2. Войти в веб (URL от разворачивающего). 3. Создавать и вести заявки, просматривать контрагентов. |

---

## Сводка: как проходит запрос пользователя

### Если пользователь работает через веб (`http://localhost:8080`)
1. Пользователь открывает сайт.
2. `gateway` принимает запрос и отдаёт SPA из `web`.
3. Когда пользователь логинится, создаёт заявки, загружает файлы или работает в чате, фронтенд вызывает `/api/...`.
4. `gateway` маршрутизирует API-запросы в `backend`.
5. `backend` выполняет бизнес-логику, работает с БД, сохраняет файлы в `backend/uploads` и возвращает результат.
6. Фронтенд обновляет интерфейс без ручной перезагрузки страницы.

### Если пользователь работает через Telegram-бота
1. Пользователь отправляет боту команду (`/start`, `/info` и т.д.).
2. `tg_bot` обращается к `backend` через внутренний адрес `http://gateway`.
3. `backend` возвращает действие, ссылки и данные.
4. Бот отправляет итоговое сообщение пользователю.

## Схема токенов и сессии

В проекте используются четыре независимых типа токенов:

### 1. `access_token`
- Используется только для REST API и WebSocket.
- Это short-lived JWT.
- Хранится только в памяти фронтенда.
- В `localStorage` и `sessionStorage` не сохраняется.
- Содержит минимальные claims:
  - `sub`
  - `type=access`
  - `scope=session_access`
  - `iat`
  - `exp`

Как работает:
- После `POST /api/v1/auth/login` backend возвращает `access_token` в JSON-ответе.
- Frontend кладёт его только в in-memory auth state.
- Все обычные API-запросы отправляют `Authorization: Bearer <access_token>`.
- WebSocket чат подключается с этим же токеном через query param `?token=...`.

Как проверяется:
- Backend валидирует подпись JWT.
- Проверяет `type=access`, `scope=session_access`, `sub`, `exp`.
- После decode всегда дочитывает пользователя из БД.
- Роль, статус и доступы определяются по БД, а не только по claims токена.

TTL:
- `access_token`: 5 минут.

### 2. `refresh_token`
- Используется только для bootstrap сессии и silent refresh.
- Это stateless JWT.
- Хранится только в `HttpOnly` cookie.
- Не используется как Bearer token.
- Не хранится в БД.

Claims:
- `sub`
- `type=refresh`
- `scope=session_refresh`
- `iat`
- `exp`
- `max_exp`
- `fp`

Что такое `fp`:
- `fp` — fingerprint, построенный на основе текущего `password_hash` пользователя.
- Если пароль пользователя изменится, старые refresh token перестанут проходить проверку.

Как работает:
- После логина backend ставит refresh token в `HttpOnly` cookie.
- При старте приложения frontend сначала делает `POST /api/v1/auth/refresh`.
- Если cookie валидна, backend выдаёт новый `access_token` и перевыпускает refresh cookie.
- Если cookie невалидна или истекла, фронтенд переходит в `anonymous`.

Как проверяется:
- Backend читает refresh token только из cookie.
- Проверяет подпись JWT.
- Проверяет `type=refresh`, `scope=session_refresh`, `sub`, `exp`, `max_exp`, `fp`.
- Затем дочитывает пользователя из БД и сверяет `fp` с текущим `password_hash`.

TTL:
- idle TTL: 30 минут.
- absolute max TTL: 12 часов.

### 3. `upload_token`
- Используется только для вложений чата.
- Не является session token.
- Не подходит для REST или WebSocket аутентификации.

Как работает:
1. Пользователь сначала загружает файл обычным авторизованным запросом.
2. Backend возвращает `file_id` и `upload_token`.
3. При отправке сообщения фронтенд передаёт `file_id + upload_token` в `message.send`.
4. Backend отдельно проверяет токен и привязывает загруженный файл к сообщению.

Что проверяется:
- `scope=chat_upload`
- `file_id`
- `offer_id`
- `sub=user_id`
- `exp`
- наличие файла в БД
- принадлежность файла и пользователя текущей сессии

TTL:
- 15 минут.

### 4. TG / email токены
- Это отдельные одноразовые verify/exchange токены.
- Они не являются обычной session auth.

#### Telegram auth token
- Используется только для deep-link входа через Telegram.
- Ссылка из Telegram ведёт сразу на web-страницу `/auth/tg/login?token=...`.
- На этой странице токен обменивается на обычную session auth пару через `POST /api/v1/auth/tg/exchange`.

#### Email verification token
- Используется только для `/api/v1/auth/verify-email`.
- Не логинит пользователя и не создаёт сессию.

TTL:
- TG auth deep-link token: 10 минут.
- Email verification token: 1 час.

## Lifecycle сессии

### Login
1. Frontend вызывает `POST /api/v1/auth/login`.
2. Backend проверяет логин/пароль и статус пользователя.
3. Backend возвращает `access_token` и ставит refresh cookie.
4. Frontend переводит auth state в `authenticated`.
5. После этого открывается WebSocket.

### Bootstrap после reload / F5
1. Приложение стартует в состоянии `bootstrapping`.
2. Frontend вызывает `POST /api/v1/auth/refresh`.
3. Если refresh cookie ещё валидна:
   - backend возвращает новый `access_token`;
   - frontend восстанавливает сессию.
4. Если refresh не удался:
   - frontend становится `anonymous`;
   - пользователя можно отправлять на login.

### Когда `access_token` истёк
1. API-запрос получает `401`.
2. Frontend не разлогинивает пользователя сразу.
3. Выполняется один refresh attempt.
4. Если refresh успешен, исходный запрос повторяется один раз.
5. Если refresh неуспешен, выполняется logout.

### Idle timeout
- Сессия должна умирать после 30 минут бездействия.
- Поэтому silent refresh разрешён только если на фронте была недавняя активность пользователя:
  - mouse
  - keyboard
  - pointer
  - touch
  - focus
  - navigation
- Фоновые retry/reconnect не должны бесконечно продлевать сессию.

### Logout
1. Frontend очищает in-memory auth state.
2. Вызывает `POST /api/v1/auth/logout`.
3. Backend всегда очищает refresh cookie.
4. WebSocket закрывается контролируемо.

### WebSocket
- Использует только `access_token`.
- При auth failure backend закрывает сокет с кодом `4401`.
- Frontend не уходит в бесконечный reconnect-loop.
- Вместо этого:
  1. делает один refresh;
  2. при успехе переподключает сокет;
  3. при провале завершает сессию.

## Что поднимается

- `backend` — FastAPI (`backend`)
- `web` — frontend SPA (`web`)
- `gateway` — Nginx reverse proxy, входная точка
- `tg_bot` — Telegram bot (`tg_bot`)
- `rabbitmq` — брокер событий + UI (`http://localhost:15672`)
- `notifications_worker` — воркер отправки email/TG уведомлений
- `ngrok` — опционально, через профиль `ngrok`

Все контейнеры работают в одной сети `project_net`.

---

## Предварительные требования

- Docker Engine
- Docker Compose plugin (`docker compose`)

Проверьте:

```bash
docker --version
docker compose version
```

---

## Подготовка `.env`

### 1. Backend

Создайте файл `backend/.env`:

```env
DATABASE_URL=sqlite+aiosqlite:///./app.db
JWT_SECRET=change_me
REFRESH_TOKEN_SECRET=change_me_refresh
BOT_TOKEN=123456:ABCDEF...
PUBLIC_BACKEND_BASE_URL=http://localhost:8080
WEB_BASE_URL=http://localhost:8080
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
ACCESS_TOKEN_TTL_SECONDS=300
REFRESH_TOKEN_IDLE_TTL_SECONDS=1800
REFRESH_TOKEN_MAX_TTL_SECONDS=43200
REFRESH_COOKIE_NAME=acom_refresh_token
REFRESH_COOKIE_SAMESITE=lax
REFRESH_COOKIE_SECURE=false
TG_AUTH_TTL_SECONDS=600
EMAIL_VERIFICATION_TTL_SECONDS=3600
```

Для PostgreSQL укажите ваш `DATABASE_URL`, например:
`postgresql+asyncpg://user:password@host:5432/dbname`

`notifications_worker` использует `backend/.env` для SMTP и Telegram-уведомлений.

### 2. Telegram bot

Создайте файл `tg_bot/.env`:

```env
BOT_TOKEN=123456:ABCDEF...
BACKEND_BASE_URL=http://gateway
PUBLIC_BACKEND_BASE_URL=http://localhost:8080
REQUEST_TIMEOUT_SECONDS=5
```

### 3. Ngrok

Если используете ngrok, проверьте `backend/ngrok.yml`: там должны быть корректные `authtoken` и туннель `public` на `gateway:80`.

---

## Запуск

### Базовый запуск

```bash
docker compose up -d --build
```

После запуска:

- Приложение: `http://localhost:8080`
- API: `http://localhost:8080/api/v1/...`
- RabbitMQ UI: `http://localhost:15672`

Если после обновления контейнеров фронтенд отвечает `502`, перезапустите `gateway`:

```bash
docker compose restart gateway
```

### Запуск с ngrok

```bash
docker compose --profile ngrok up -d --build
```

- UI ngrok: `http://localhost:4040`

`gateway` в compose запускается после healthcheck `backend` и `web`, чтобы снизить риск старта с неготовыми upstream-сервисами.

---

## Полезные команды

Логи всех сервисов:

```bash
docker compose logs -f
```

Логи конкретного сервиса:

```bash
docker compose logs -f backend
docker compose logs -f web
docker compose logs -f gateway
docker compose logs -f tg_bot
docker compose logs -f rabbitmq
docker compose logs -f notifications_worker
docker compose logs -f ngrok
```

Остановить и удалить контейнеры:

```bash
docker compose down
```

Остановить с удалением томов:

```bash
docker compose down -v
```

---

## Запуск только части сервисов

Например, только `backend + gateway + web`:

```bash
docker compose up -d --build backend gateway web
```

Только `backend + gateway`:

```bash
docker compose up -d --build backend gateway
```

---

## Отдельные compose-файлы модулей

При необходимости можно запускать модульные compose-файлы:

- `backend/docker-compose.yml`
- `backend/docker-compose.ngrok.yml`
- `web/docker-compose.yml`
- `tg_bot/docker-compose.yml`

Они используют ту же сеть `project_net`, поэтому сервисы видят друг друга по именам контейнеров и сервисов.

---

## Управление пользователями

### Добавление экономиста или администратора

- Через веб: войти как superadmin → «Пользователи» → «Экономисты» или «Администраторы» → «Добавить пользователя».
- Через API: `POST /api/v1/users/register` с токеном superadmin и телом `{login, password, role_id}` (role_id: 2 — админ, 3 — ведущий экономист, 4 — экономист).

### Регистрация контрагента через бота

1. Бот отправляет ссылку на регистрацию.
2. Контрагент проходит её — профиль появляется во вкладке «Контрагенты» (статус `review`).
3. Суперадмин переводит статус в `active` — в Telegram приходит подтверждение о выдаче прав.
4. Контрагент вызывает `/start` — получает открытые заявки и ссылки на авторизацию.

### Создание заявки

Нужна минимум одна открытая заявка. Создать можно через суперадмина или под экономистом.

> Подробный план и последние изменения — в `DEPLOYMENT_PLAN.md` (корень acom-project).
