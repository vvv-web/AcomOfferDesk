# Order Web

Современный React + TypeScript SPA-клиент для работы с backend API через относительный префикс `/api`.

## Структура проекта

```
src/
  app/                # корневые провайдеры и общий каркас приложения
  pages/              # страницы
  features/           # функциональные модули (фичи)
  shared/             # переиспользуемые части (api, theme, ui)
```

## API и деплой

- Фронтенд работает только с относительными URL (`/api/...`).
- В production API проксируется Nginx-конфигурацией (`/api/* -> backend:8000/api/*`).
- Роутинг SPA обслуживается через fallback на `index.html`.

## Запуск в Docker

```bash
docker compose up --build
```

Приложение будет доступно на `http://localhost:3000`.