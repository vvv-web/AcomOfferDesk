# Окружения

Этот документ описывает, как в AcomOfferDesk разделены режимы `dev`, `test` и `prod`,
и как устроены Docker Compose-файлы, чтобы локальная разработка оставалась удобной,
а production-like запуск не подтягивал dev-only поведение.

## Модель окружений

| Окружение | Назначение | Публичная точка входа | Tunnel-инструменты | Host ports у сервисов |
|---|---|---|---|---|
| `dev` | Локальная разработка на одном ПК | Локальный `gateway` на `http://localhost:8080` | Разрешены, только для dev | Разрешены для локального удобства |
| `test` | Автодеплой на отдельную машину или VPS | Внешний HTTPS reverse proxy | Запрещены | Только internal/admin доступ |
| `prod` | Боевой внутренний контур компании | Внешний HTTPS reverse proxy | Запрещены | Только internal/admin доступ |

## Роли runtime-компонентов

| Компонент | Роль |
|---|---|
| `gateway` | Внутренний Nginx-контейнер приложения, единая точка входа внутри Docker |
| Public reverse proxy | Внешний Nginx, Caddy, Traefik или корпоративный proxy, который завершает публичный HTTPS |
| VPS | Сервер или инфраструктурная машина, на которой выполняется деплой |
| Терминальный сервер | Единственный административный путь доступа к служебным UI и операциям сопровождения |

`gateway` и внешний reverse proxy — не одно и то же. Внешний reverse proxy
принимает публичный HTTPS-трафик и проксирует его во внутренний Docker-hosted `gateway`.

## Структура Compose

| Файл | Назначение |
|---|---|
| `docker-compose.yml` | Общая internal-first topology: сервисы, зависимости, сети, healthchecks |
| `docker-compose.dev.yml` | Override для локальной разработки: host ports, dev-команда Keycloak, optional tunnel profiles |
| `docker-compose.prod-like.yml` | Production-like override: наружу публикуется только публичная точка входа приложения |
| `docker-compose.init.yml` | Одноразовые init-задачи для подготовки schema и bootstrap Keycloak |

## Почему базовый файл internal-first

Docker Compose объединяет `ports` аддитивно, поэтому безопасно "удалять" их
через override неудобно и рискованно. Чтобы не зависеть от этого поведения:

1. `docker-compose.yml` задаёт только внутренние `expose`-контракты.
2. Host `ports` вынесены в `docker-compose.dev.yml`, где они нужны для локальной работы.
3. `docker-compose.prod-like.yml` публикует только `gateway`, что повторяет модель `test/prod`.

Это делает production-like запуск безопаснее по умолчанию и исключает хрупкую
логику очистки `ports` через override.

Из-за этого разделения простой `docker compose up` больше не является
рекомендуемой dev-командой. Для локальной разработки нужно явно использовать
`-f docker-compose.yml -f docker-compose.dev.yml`, чтобы host ports и tunnel profiles
включались только осознанно.


## Сценарии запуска

### Dev

Цель: локальная разработка на одном ПК, отладка, работа через `localhost`,
а при необходимости сразу через `ngrok` для корректных email-ссылок, OIDC redirect
и callback flow.

Предпосылки:

1. Создан Docker network `project_net`.
2. Подготовлен файл `.env.dev` на основе `.env.dev.example`.
3. Доступна внешняя БД `order_database`.

Базовый запуск:

```bash
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Если в локальной разработке нужно сразу получать корректные публичные ссылки
в email, OIDC redirect flow и других внешних сценариях, обычный dev-паттерн —
сразу поднимать `ngrok` вместе с локальным стеком.

Dev tunnel profiles:

```bash
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml --profile ngrok up -d ngrok
docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml --profile tunnel up -d localtunnel
```

Типичный локальный сценарий с `ngrok`:

1. Запустить основной dev-стек.
2. Поднять `ngrok`.
3. Прописать выданный `https://...ngrok-free.dev` в:
   - `WEB_BASE_URL`
   - `PUBLIC_BACKEND_BASE_URL`
   - `KEYCLOAK_PUBLIC_BASE_URL`
   - `KEYCLOAK_ISSUER_URL`
   - `KC_HOSTNAME`
4. Пересоздать сервисы, которым нужен обновлённый публичный URL.

Проверки после запуска:

- приложение доступно на `http://localhost:8080`;
- RabbitMQ UI доступен на `http://localhost:15672`;
- MinIO API доступен на `http://localhost:9000`;
- MinIO Console доступен на `http://localhost:9001`;
- при использовании `ngrok` внешние ссылки в письмах и redirect flow используют публичный HTTPS URL.

### Test

Цель: запуск на отдельной машине или VPS в режиме, максимально похожем на `prod`.

Предпосылки:

1. Подготовлен файл `.env.test` или `.env.prod-like.local` по образцу `.env.prod-like.example`.
2. Перед контейнерами стоит внешний reverse proxy, который принимает публичный HTTPS.
3. Административный доступ организован только через терминальный сервер.
4. Tunnel-инструменты не используются.

Запуск:

```bash
docker compose --env-file .env.test -f docker-compose.yml -f docker-compose.prod-like.yml up -d --build
```

Если в test пока используется локальное имя env-файла:

```bash
docker compose --env-file .env.prod-like.local -f docker-compose.yml -f docker-compose.prod-like.yml up -d --build
```

Что должно получиться:

- наружу на host публикуется только `gateway`;
- `backend`, `keycloak`, `rabbitmq`, `minio` и другие внутренние сервисы не открыты напрямую;
- публичный вход идёт через внешний HTTPS reverse proxy;
- служебные UI доступны администратору только через терминальный сервер;
- Keycloak работает через `start`, а не `start-dev`.

### Prod

Цель: боевой запуск во внутреннем контуре компании с ограниченным внешним HTTPS-доступом для контрагентов.

Предпосылки:

1. Подготовлен реальный production env-файл, например `.env.prod`, на основе `.env.prod-like.example`.
2. Настроен внешний reverse proxy с публичным HTTPS-доменом.
3. Административный доступ идёт исключительно через терминальный сервер.
4. Используются реальные секреты, не закоммиченные в репозиторий.
5. Tunnel-инструменты полностью исключены.

Запуск:

```bash
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod-like.yml up -d --build
```

Что должно получиться:

- внешние пользователи и контрагенты входят только через публичный HTTPS endpoint;
- наружу не опубликованы `backend:8000`, `keycloak:8080`, `postgres:5432`, `rabbitmq:5672`, `rabbitmq-ui:15672`, `minio:9000`, `minio-console:9001`, `pgadmin:5050`;
- внутренние сервисы общаются только по internal/private network;
- служебные интерфейсы не доступны из публичного интернета;
- Keycloak использует production-compatible запуск через `start`.

## Команды

### Production-like локально или в test

```bash
docker compose --env-file .env.prod-like.local -f docker-compose.yml -f docker-compose.prod-like.yml up -d --build
```

### Получить итоговую merged-конфигурацию

```bash
docker compose --env-file .env.prod-like.local -f docker-compose.yml -f docker-compose.prod-like.yml config
```

### Инициализация Keycloak

Одноразовые init-сервисы запускаются с тем же env contract, что и целевой режим:

```bash
docker compose --env-file .env.dev -f docker-compose.init.yml up keycloak_db_prepare
docker compose --env-file .env.dev -f docker-compose.init.yml up keycloak_bootstrap
```

```bash
docker compose --env-file .env.prod-like.local -f docker-compose.init.yml up keycloak_db_prepare
docker compose --env-file .env.prod-like.local -f docker-compose.init.yml up keycloak_bootstrap
```

## Env-файлы

| Файл | Назначение |
|---|---|
| `.env.dev` | Значения для локальной разработки, localhost URL и опциональные tunnel-настройки |
| `.env.prod-like.local` | Локальная production-like проверка или test-подобный запуск |
| `.env.dev.example` | Безопасный шаблон для создания `.env.dev` |
| `.env.prod-like.example` | Безопасный шаблон для создания `.env.prod-like.local` |

Выбранный env-файл используется и для Compose interpolation, и как runtime `env_file`
для `backend`, `keycloak`, `notifications_worker` и init-задач через `APP_RUNTIME_ENV_FILE`.

Все env-файлы этого контура хранятся в корне проекта. `backend/.env` больше не является
основным местом конфигурации и оставлен только как legacy-ориентир для совместимости.

## Ключевое поведение по режимам

| Вопрос | Dev | Production-like / Test / Prod |
|---|---|---|
| Команда запуска Keycloak | Разрешён `start-dev` | Обязателен `start` |
| Public URLs | Обычно `ngrok` URL для корректных email/callback ссылок, либо `localhost` для purely local сценариев | Реальный HTTPS URL приложения |
| Tunnel tooling | Разрешён, `ngrok` является нормальным dev-инструментом | Запрещён |
| Host-доступ к RabbitMQ UI / MinIO Console | Разрешён на localhost при необходимости | Только через admin-only путь |
| Прямой публичный доступ к backend / Keycloak / RabbitMQ / MinIO | Не обязателен | Запрещён |

## Acceptance checklist для этапа 1

- [ ] Dev-запуск по-прежнему работает через `docker-compose.dev.yml`.
- [ ] Production-like config успешно рендерится через `docker compose ... config`.
- [ ] `ngrok`, `cloudflared` и `localtunnel` отсутствуют в production-like запуске.
- [ ] Keycloak в production-like режиме не использует `start-dev`.
- [ ] `backend`, `keycloak`, `rabbitmq`, `minio` и возможные admin UI не публикуются наружу через host `ports` в production-like.
- [ ] Admin UI задокументированы как admin-only только через терминальный сервер.
- [ ] `.env.prod-like.example` не содержит слабых credentials по умолчанию.
- [ ] Реальные env-файлы по-прежнему игнорируются Git.
- [ ] Public, dev tunnel, internal и admin flows описаны отдельно.

## Связанные документы

- [Сетевой периметр](./network-perimeter.md)
- [Административный доступ](./admin-access.md)
- [Runtime-архитектура](./runtime-architecture.md)

