# Вход по внешним ссылкам (email)

## Назначение

Зафиксировать единое поведение внешних ссылок и убрать неявные обходы OIDC.

## Главное правило

- Внешняя ссылка не создает web-сессию напрямую.
- Пользователь всегда проходит обычный вход через Keycloak.
- После входа пользователь возвращается на нужную страницу через параметр `next`.

## Текущее поведение

### Email

- Ссылки из email-уведомлений ведут на `/login?next=...`.
- Ссылка верификации email (`/api/v1/auth/verify-email`) только подтверждает email и не создает сессию.
- Magic-login по письму не используется.

### Legacy Telegram (отключен по умолчанию)

- Telegram-эндпойнты сохранены как legacy для обратной совместимости.
- Для production-потока используется только email/OIDC.
- Включение legacy-режима выполняется через `LEGACY_TELEGRAM_ENABLED=true`.
<!-- docs-linking-marker-2026-04-29 -->
## Смежные документы

- Детали first login, auto-link и верификации пользователей: [keycloak-autolink.md](./keycloak-autolink.md)
- Единые сценарии запуска (dev/test/prod): [environments.md](./environments.md)
- Сетевой периметр и admin-only доступ: [network-perimeter.md](./network-perimeter.md), [admin-access.md](./admin-access.md)
