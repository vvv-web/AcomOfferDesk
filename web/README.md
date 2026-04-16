# Web (`/web`)

Frontend-клиент AcomOfferDesk на React + TypeScript.

## Стек

- React 18
- TypeScript
- Vite
- MUI
- React Router
- React Hook Form + Zod

## Структура

```text
src/
  app/        провайдеры, маршрутизация, layout
  pages/      страницы
  features/   прикладные фичи
  entities/   доменные сущности
  shared/     API-клиент, UI-компоненты, утилиты, константы
```

## Как frontend ходит в API

- Все запросы идут по относительным путям `/api/...`.
- В Docker runtime трафик проксирует `gateway`:
  - `/` -> `web`
  - `/api/*` -> `backend`
  - `/iam/*` -> `keycloak`

## Запуск

### В составе основного проекта (рекомендуется)

```bash
docker compose up -d --build
```

Приложение доступно через `http://localhost:8080`.

### Только frontend (без gateway/backend)

Локальный dev-server:

```bash
cd web
npm install
npm run dev
```

По умолчанию Vite слушает `http://localhost:4173`.

## Важные замечания по auth

- Текущий Web UI использует вход через Keycloak redirect flow.
- Прямой вход по внешним legacy-ссылкам не используется.
- Сессия восстанавливается через `POST /api/v1/auth/refresh`.

