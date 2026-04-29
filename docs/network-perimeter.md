# Сетевой периметр

Этот документ формализует, какой трафик в AcomOfferDesk является публичным,
какой внутренним, а какой административным.

## Правила

- В `test` и `prod` пользователи и контрагенты входят только через публичную HTTPS-точку входа.
- Публичный интернет не должен напрямую открывать `backend`, `keycloak`, PostgreSQL, RabbitMQ, RabbitMQ UI, MinIO API, MinIO Console, pgAdmin и tunnel-инструменты.
- Внутренние сервисы взаимодействуют между собой через Docker-сети или private network.
- Служебные UI доступны только через терминальный сервер.
- `ngrok`, `cloudflared` и `localtunnel` — только dev-инструменты; они не являются частью `test` и `prod`.

## A. Public user flow для test и prod

| Откуда | Куда | Порт / протокол | Комментарий |
|---|---|---|---|
| Внешний пользователь или контрагент | Public reverse proxy | `443` HTTPS | Основная публичная точка входа |
| Опциональный redirect | Public reverse proxy | `80` HTTP | Redirect на HTTPS, если нужен |
| Public reverse proxy | `gateway` | Private upstream | Проксирование во внутренний Docker-host или приватный интерфейс |
| `gateway` | `web` | Internal HTTP `80` | SPA |
| `gateway` | `backend` | Internal HTTP `8000` | API |
| `gateway` | `keycloak` | Internal HTTP `8080` | OIDC-маршруты под `/iam` |

В `test` и `prod` следующие порты не должны быть публично открыты:

| Порт | Сервис |
|---|---|
| `8000` | `backend` |
| `8080` | прямой доступ к `keycloak` |
| `5432` | PostgreSQL |
| `5672` | RabbitMQ AMQP |
| `15672` | RabbitMQ UI |
| `9000` | MinIO API |
| `9001` | MinIO Console |
| `5050` | pgAdmin |

## B. Dev tunnel flow

Этот сценарий допустим только для локальной разработки.
Для AcomOfferDesk это нормальный рабочий dev-сценарий, потому что email-ссылки,
OIDC redirect/callback flow и другие внешние переходы должны использовать
корректный публичный HTTPS URL даже при локальном запуске.

| Откуда | Куда | Порт / протокол | Комментарий |
|---|---|---|---|
| Внешний тестировщик | Публичный endpoint `ngrok` | `443` HTTPS | Временный dev-only URL |
| `ngrok` | Локальный `gateway` | HTTP `80` | Tunnel приходит в локальный gateway-контейнер |
| `gateway` | `web` / `backend` / `keycloak` | Внутренний Docker-трафик | Та же внутренняя маршрутизация, что и в dev |

`ngrok` не является частью `test` или `prod` архитектуры.

## C. Internal service flow

| Откуда | Куда | Порт | Назначение |
|---|---|---|---|
| `gateway` | `web` | `80` | Выдача SPA |
| `gateway` | `backend` | `8000` | REST API и health routes |
| `gateway` | `keycloak` | `8080` | OIDC и IAM-пути под `/iam` |
| `backend` | `keycloak` | `8080` | OIDC metadata, JWKS, token и admin-related вызовы |
| `backend` | PostgreSQL | `5432` | Основное приложение |
| `keycloak` | PostgreSQL | `5432` | Хранение схемы Keycloak |
| `backend` | RabbitMQ | `5672` | Публикация notification events |
| `notifications_worker` | RabbitMQ | `5672` | Чтение notification events |
| `backend` | MinIO | `9000` | API объектного хранилища |
| `notifications_worker` | SMTP | `465` / `587` | Отправка уведомлений |
| `keycloak` | SMTP | `465` / `587` | Почта для IAM и verify email |
| `backend` | IMAP | `993` | Опциональный mailbox polling, если настроен |
| `notifications_worker` | IMAP | `993` | Только если worker-side polling появится позже |

## D. Admin flow

| Откуда | Куда | Порт | Политика доступа |
|---|---|---|---|
| Администратор | Терминальный сервер | `3389` | Private admin path |
| Терминальный сервер | RabbitMQ UI | `15672` | Только для администратора |
| Терминальный сервер | MinIO Console | `9001` | Только для администратора |
| Терминальный сервер | pgAdmin | `5050` | Только для администратора, если сервис будет добавлен |

## Явные исправления старых смысловых связей

- Внешний пользователь не должен идти в Keycloak напрямую на публичный `8080`. Вход всегда идёт через публичный HTTPS и `gateway`.
- `gateway` не ходит в PostgreSQL на `5432`. С БД работают `backend` и `keycloak`.
- `ngrok` и другие внешние tunnel-решения не являются частью `test` и `prod` архитектуры.
- Публичный HTTPS завершается на внешнем reverse proxy, а не на внутреннем контейнере `gateway`.

## Текущие последствия для Compose

| Режим | Что публикуется наружу на host |
|---|---|
| `docker-compose.dev.yml` | `gateway:8080`, `rabbitmq:15672`, `minio:9000`, `minio:9001`, опционально `ngrok:4040` |
| `docker-compose.prod-like.yml` | только `gateway:8080` |

Если позже появятся admin-инструменты вроде pgAdmin, они должны следовать
той же admin-only политике и не попадать в публичный perimeter.
