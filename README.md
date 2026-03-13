# AcomOfferDesk — развёртывание через Docker Compose

Этот репозиторий можно поднять одной командой через корневой `docker-compose.yml`.

## Сводка для пользователя: как обрабатываются действия

### Если пользователь работает через веб (`http://localhost:8080`)
1. Пользователь открывает сайт.
2. `gateway` принимает запрос и отправляет его в `web` (SPA).
3. Когда пользователь нажимает кнопки/отправляет формы (вход, создание заявок, загрузка файлов), фронтенд вызывает `/api/...`.
4. `gateway` маршрутизирует эти API-запросы в `backend`.
5. `backend` выполняет бизнес-логику, работает с БД, сохраняет загруженные файлы в `backend/uploads` и возвращает результат.
6. Пользователь сразу видит обновлённый статус/данные в интерфейсе.

### Если пользователь работает через Telegram-бота
1. Пользователь отправляет команду боту (`/start`, `/info`).
2. `tg_bot` обрабатывает команду и запрашивает данные у `backend` через внутренний адрес `http://gateway`.
3. `backend` возвращает действие/данные (например, регистрацию, статус модерации, список заявок, ссылки).
4. Бот отправляет пользователю итоговое сообщение и кнопки.


## Что поднимается

- `backend` — FastAPI (`backend`)
- `web` — frontend SPA (`web`)
- `gateway` — Nginx reverse proxy (входная точка)
- `tg_bot` — Telegram bot (`tg_bot`)
- `rabbitmq` — брокер событий + UI (`http://localhost:15672`)
- `notifications_worker` — воркер обработки email/tg уведомлений
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

### 1) Backend

Создайте файл `backend/.env` (минимум):

```env
DATABASE_URL=sqlite+aiosqlite:///./app.db
JWT_SECRET=change_me
BOT_TOKEN=123456:ABCDEF...
PUBLIC_BACKEND_BASE_URL=http://localhost:8080
WEB_BASE_URL=http://localhost:8080
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
```

> Для PostgreSQL укажите ваш `DATABASE_URL`, например:  
> `postgresql+asyncpg://user:password@host:5432/dbname`

> `notifications_worker` использует `backend/.env` (SMTP и `BOT_TOKEN`) для фактической отправки email и Telegram-уведомлений.

### 2) Telegram bot

Создайте файл `tg_bot/.env`:

```env
BOT_TOKEN=123456:ABCDEF...
BACKEND_BASE_URL=http://gateway
PUBLIC_BACKEND_BASE_URL=http://localhost:8080
REQUEST_TIMEOUT_SECONDS=5
```

### 3) Ngrok (если нужен)

Проверьте `backend/ngrok.yml`: должен быть корректный `authtoken` и туннель `public` на `gateway:80`.

---

## Запуск

### Базовый запуск (без ngrok)

```bash
docker compose up -d --build
```

После запуска:

- Приложение: `http://localhost:8080`
- API: `http://localhost:8080/api/v1/...`
- RabbitMQ UI: `http://localhost:15672`
- Если после обновления контейнеров фронт отвечает `502` (чаще всего из-за смены IP у `web`), перезапустите `gateway`: `docker compose restart gateway`.

### Запуск с ngrok

```bash
docker compose --profile ngrok up -d --build
```

- Локальный UI ngrok: `http://localhost:4040`

`gateway` в compose настроен с `restart: unless-stopped` и запускается после healthcheck `backend` и `web`, чтобы снизить риск старта с неготовыми upstream-сервисами.
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

Например, только backend + gateway + web:

```bash
docker compose up -d --build backend gateway web
```

Только backend + gateway:

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

Они используют ту же сеть `project_net`, поэтому сервисы видят друг друга по именам контейнеров/сервисов.
