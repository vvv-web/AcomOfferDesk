# Backend (`/backend`)

## Что поднимается

В backend-части есть два compose-файла:

- `docker-compose.yml` — поднимает:
  - `backend` (FastAPI приложение),
  - `gateway` (Nginx reverse-proxy).
- `docker-compose.ngrok.yml` — поднимает отдельный контейнер `ngrok`, который публикует наружу `gateway:80`.

Оба compose используют внешнюю docker-сеть `project_net`.

---

## Маршрутизация запросов

### 1) Входной слой: Nginx (`gateway`)

`gateway` слушает `80` внутри контейнера и пробрасывается локально как `8080:80`.

Правила из `nginx.conf`:

- `location /api/` → проксируется в `http://backend:8000/api/`.
  - Это весь backend API (`/api/v1/...`).
- `location /` → проксируется в `http://web:80/`.
  - Это фронтенд (SPA), если в сети `project_net` есть контейнер `web`.

Итого:
- API идёт через Nginx на backend;
- всё остальное (корень `/`, статика/роуты фронта) идёт на web.

### 2) Внутренний слой: FastAPI (`backend`)

В приложении API подключен с префиксом `/api/v1`.

Примеры конечных URL через gateway:
- `http://localhost:8080/api/v1/auth/login`
- `http://localhost:8080/api/v1/users`

---

## Для чего нужен ngrok

`ngrok` нужен, чтобы дать **публичный URL** во внешний интернет для локального docker-стека.

В текущей конфигурации:
- `ngrok` поднимает туннель `public`;
- туннель направлен на `gateway:80`;
- значит снаружи доступны и фронт, и API через один публичный домен ngrok (точно так же, как локально через gateway).

Это удобно для:
- Telegram-бота и внешних клиентов,
- демонстраций,
- тестов, где нужен публичный доступ к локальному окружению.

---

## Как это работает вместе (схема)

```text
Интернет / браузер / tg_bot
          |
          v
   ngrok public URL  (опционально)
          |
          v
      gateway:80 (nginx)
       |                 \
       | /api/*           \ /
       v                   v
 backend:8000           web:80
 (FastAPI)             (frontend)
```

Если ngrok не запущен, тот же маршрут работает локально:

`клиент -> localhost:8080 -> gateway -> backend/web`

---

## Файлы и их роль

- `docker-compose.yml`
  - backend + gateway, локальная точка входа `localhost:8080`.
- `docker-compose.ngrok.yml`
  - отдельный сервис ngrok, который публикует gateway наружу.
- `nginx.conf`
  - правила reverse proxy между `/api/` и фронтом.
- `ngrok.yml`
  - описание туннеля `public` на `gateway:80`.

---

## Запуск

### 1) Подготовить внешнюю сеть (один раз)

```bash
docker network create project_net
```

### 2) Поднять backend + gateway

```bash
docker compose -f backend/docker-compose.yml up -d --build
```

После запуска:
- локальный вход: `http://localhost:8080`
- API: `http://localhost:8080/api/v1/...`

### 3) Поднять ngrok (если нужен публичный доступ)

```bash
docker compose -f backend/docker-compose.ngrok.yml up -d
```

Проверить туннель можно:
- в логах контейнера `ngrok`,
- через UI ngrok: `http://localhost:4040`.

---

## Замечания по окружению

- `backend` читает переменные из `backend/.env`.
- `ngrok` также читает `.env`, а конфиг туннеля берёт из `backend/ngrok.yml`.
- В `ngrok.yml` должен быть корректный `authtoken`.
- В `docker-compose.yml` gateway ожидает наличие сервиса `web` в сети `project_net`; если фронтенд не запущен, роуты не из `/api/` будут недоступны.
