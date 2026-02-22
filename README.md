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
```

> Для PostgreSQL укажите ваш `DATABASE_URL`, например:  
> `postgresql+asyncpg://user:password@host:5432/dbname`

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

### Запуск с ngrok

```bash
docker compose --profile ngrok up -d --build
```

- Локальный UI ngrok: `http://localhost:4040`

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
