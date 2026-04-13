# Автопривязка Keycloak и первый вход

## Назначение

Документ описывает, как AcomOfferDesk связывает локального пользователя с аккаунтом Keycloak при первом входе.

Результат успешной привязки всегда один:

- в `user_auth_accounts` появляется запись с `provider='keycloak'`
- `external_subject_id` заполняется значением `sub` из Keycloak

После этого следующие входы идут по готовой связке.

## Базовая логика

1. Пользователь проходит аутентификацию в Keycloak.
2. Backend читает claims access token.
3. Если связка уже есть, используется она.
4. Если связки нет, backend пытается auto-link по правилам окружения.
5. Если auto-link невозможен, вход отклоняется (`not_linked` на callback-странице).

## APP_ENV и KEYCLOAK_VERIFY_EMAIL (частые путаницы)

- В **`backend/.env` должна быть одна строка `APP_ENV=...`**. Упоминание `development` в комментариях к шаблону — это напоминание для копии на локальную машину, а не «второе значение» в том же файле на сервере.
- Если **`APP_ENV` не задан** в `.env`, бэкенд (`app/core/config.py`, `Settings`) использует **дефолт `development`**. На production VPS это давало рассинхрон: сервер вёл себя как development в части проверок окружения.
- **`KEYCLOAK_VERIFY_EMAIL` не является полем `Settings` в Python** — её читает **`infra/keycloak/bootstrap.sh`** при настройке realm (и окружение контейнера bootstrap). Поведение:
  - **явно `false`** → в realm передаётся **`verifyEmail: false`** — регистрация без обязательного подтверждения email в Keycloak (формально «легче» саморегистрация);
  - **пусто** → скрипт сам выставляет: при **`APP_ENV=production`** — `true`, иначе — `false`.
- Прод-автолинк по email (`KEYCLOAK_PROD_AUTO_LINK_BY_VERIFIED_EMAIL_ENABLED`) в коде требует в токене **`email_verified=true`** (`identity_sync.py`). Пока почта в Keycloak не подтверждена, этот путь не сработает — это отдельно от флага `verifyEmail` realm, но согласовано по смыслу.

Подробнее про рекомендуемые комбинации переменных — в разделе **«Правила auto-link по окружениям»** ниже.

## Практические сценарии

### 1) Bootstrap superadmin

- Локальный пользователь `superadmin` создается в БД заранее.
- При первом входе Keycloak-пользователя с `username=KEYCLOAK_BOOTSTRAP_APP_USERNAME` выполняется специальная bootstrap-привязка.
- После этого superadmin входит как обычный пользователь.

### 2) Сотрудник создан админом

Как создается сотрудник:

- UI "Пользователи" -> "Добавить пользователя"
- или API `POST /api/v1/users/register`

Что делает backend:

1. Создает локального пользователя (`users`, `profiles`).
2. Вызывает `KeycloakAdminService.ensure_user(...)`.
3. Передает `username`, `email` и пароль из формы.

Первый вход сотрудника:

1. Пользователь открывает `/login`.
2. SPA уводит в `/api/v1/auth/oidc/login`.
3. После успешной аутентификации в Keycloak backend выполняет auto-link (dev или prod правило).

### 3) Контрагент, созданный вручную

Как создается:

- API/UI `POST /api/v1/users/manual-contractor` (создание выполняет сотрудник с правами создания пользователей, например администратор или экономист).

Что делает backend:

1. Создает локального пользователя роли `contractor` со статусом `active`.
2. Создает `profiles` и `company_contacts` с плейсхолдерами/введенными значениями.
3. Создает/обновляет Keycloak-аккаунт с таким же `username`.
4. Пароль в AcomOfferDesk для контрагента, созданного вручную, не задается.

Первый вход контрагента, созданного вручную:

1. Открыть `/login`.
2. На форме Keycloak использовать `Forgot password`.
3. Получить письмо и задать пароль.
4. Войти через обычный Keycloak flow.
5. Backend выполнит auto-link по текущему правилу окружения.

Важно:

- Нужен валидный email в карточке контрагента (обычно `company_mail`), иначе сброс пароля невозможен.
- Смена пароля через API AcomOfferDesk отключена: `PATCH /api/v1/users/{id}/manual-contractor` с `password` вернет `403`.

### 4) Контрагент регистрируется самостоятельно

Текущий путь регистрации:

- `/api/v1/auth/oidc/register?tg_token=...`
- `/api/v1/auth/oidc/register?invite_token=...`

Flow:

1. Пользователь открывает ссылку регистрации.
2. Проходит регистрацию/верификацию в Keycloak.
3. На callback backend вызывает `IdentitySyncService.sync_keycloak_identity(..., allow_user_creation=True)`.
4. Если локального пользователя нет, создается новый `contractor` со статусом `review`.
5. После модерации внутри AcomOfferDesk статус переводится в `active`.

Этот сценарий не зависит от auto-link для заранее созданных пользователей.

## Правила auto-link по окружениям

### Development

Используется правило:

- `preferred_username == users.id`

Рекомендуемые настройки:

```env
APP_ENV=development
KEYCLOAK_VERIFY_EMAIL=false
KEYCLOAK_DEV_AUTO_LINK_BY_USERNAME_ENABLED=true
KEYCLOAK_PROD_AUTO_LINK_BY_VERIFIED_EMAIL_ENABLED=false
```

### Production

Используется правило:

- `email_verified == true`
- verified email из Keycloak однозначно сопоставляется с одним локальным пользователем

Рекомендуемые настройки:

```env
APP_ENV=production
KEYCLOAK_VERIFY_EMAIL=true
KEYCLOAK_DEV_AUTO_LINK_BY_USERNAME_ENABLED=false
KEYCLOAK_PROD_AUTO_LINK_BY_VERIFIED_EMAIL_ENABLED=true
```

Ограничения безопасности:

- нельзя включать dev и prod auto-link одновременно
- dev auto-link запрещен при `APP_ENV=production`

## Важные переменные `backend/.env`

- `KEYCLOAK_ENABLED`
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_VERIFY_EMAIL`
- `KEYCLOAK_DEV_AUTO_LINK_BY_USERNAME_ENABLED`
- `KEYCLOAK_PROD_AUTO_LINK_BY_VERIFIED_EMAIL_ENABLED`
- `KC_BOOTSTRAP_ADMIN_USERNAME`
- `KC_BOOTSTRAP_ADMIN_PASSWORD`
- SMTP: `EMAIL_*`, `SMTP_*` (нужны для verify/reset flows в Keycloak)

## Когда привязка должна падать

Вход намеренно блокируется, если:

- локальный пользователь не найден по текущему правилу auto-link
- в production email не подтвержден (`email_verified=false`)
- один verified email совпал с несколькими локальными пользователями
- `sub` из Keycloak уже привязан к другому локальному пользователю
- локальный пользователь уже привязан к другому Keycloak subject

В этих случаях показывается ошибка на `/auth/callback`.
