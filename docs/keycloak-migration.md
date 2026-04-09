# Keycloak Migration for AcomOfferDesk

## 1. Current auth-flow audit

- Backend is the current issuer of login/password credentials and local JWT access tokens.
- `backend/app/api/v1/auth.py` exposes `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/tg/exchange`.
- Legacy local password storage used `users.password_hash`; the target schema removes that column and treats passwords as Keycloak-managed only.
- Business authorization is already local and separated from authentication:
  - role source of truth: `users.id_role`
  - access status source of truth: `users.status`
  - org hierarchy source of truth: `users.id_parent`
- Web frontend keeps only the access token in memory and restores the session through `/api/v1/auth/refresh`.
- Telegram auth uses a separate `tg_users` bridge and can exchange a short-lived TG token into a legacy web session.

## 2. Target auth architecture

- Keycloak becomes the primary IAM for web login, self-registration, email verification, password reset and OIDC tokens.
- Backend validates Keycloak JWTs through JWKS and maps `sub` to local business users via `user_auth_accounts(provider='keycloak', external_subject_id=sub)`.
- Local PostgreSQL remains the source of truth for business role, status, hierarchy and data permissions.
- Automatic local user creation is allowed only for the Keycloak self-registration flow.
- Ordinary Keycloak login without a local link does not auto-create a business user.
- Existing legacy password auth stays available behind feature flag during rollout.

## 3. Staged migration plan

1. Add Keycloak to compose and bootstrap the application realm plus initial app superadmin account.
2. Apply external SQL/Flyway migrations for the new IAM/contact tables and keep existing user/business schema intact.
3. Switch web login/register to Keycloak redirect flow.
4. Keep `/auth/login` legacy flow behind `AUTH_ENABLE_LEGACY_PASSWORD_LOGIN=true`.
5. Migrate existing staff users by controlled linking to Keycloak accounts.
6. After migration, disable legacy password login in backend and hide the legacy form in web build.

## 4. Backend changes

- Added Keycloak config and dual-mode auth settings in `backend/app/core/config.py`.
- Added OIDC PKCE state handling in `backend/app/core/oidc_state_tokens.py`.
- Added Keycloak token/JWKS client in `backend/app/services/keycloak_oidc.py`.
- Added local identity sync service in `backend/app/services/identity_sync.py`.
- Reworked `backend/app/api/v1/auth.py`:
  - new `/auth/oidc/login`
  - new `/auth/oidc/register`
  - new `/auth/callback`
  - shared `/auth/refresh` for Keycloak and legacy sessions
  - preserved legacy `/auth/login`, `/auth/tg/exchange`, `/auth/logout`
- Reworked `backend/app/api/dependencies.py` to resolve both Keycloak and legacy bearer tokens.
- WebSocket auth in `backend/app/api/v1/ws.py` now accepts Keycloak access tokens too.
- Business permissions remain local; review contractors only keep self-profile and company-contact onboarding actions.

## 5. Frontend changes

- `web/src/app/providers/AuthProvider.tsx` now supports:
  - Keycloak redirect login
  - Keycloak self-registration redirect
  - legacy login as temporary fallback
  - session fields `authProvider`, `businessAccess`, `onboardingState`
- Added `web/src/pages/auth/AuthCallbackPage.tsx`.
- Added `web/src/pages/auth/AccountStatePage.tsx` for `review`, `inactive`, `blacklist`.
- Protected routes redirect authenticated non-active users to `/account`.
- Realtime chat now connects only when local business access is active.

## 6. Docker / env / compose changes

- Added `keycloak` service to `docker-compose.yml`.
- Added `keycloak_bootstrap` one-shot job to configure the public web client and bootstrap app superadmin.
- Gateway now proxies Keycloak under `/iam/`.
- Added Keycloak settings to `backend/env.example`.
- Added `web/.env.example` and `VITE_ENABLE_LEGACY_LOGIN` build arg support.
- Keycloak uses the same PostgreSQL instance with dedicated schema `keycloak`.

## 7. Bootstrap superadmin strategy

- Local bootstrap business user remains `users.id='superadmin', id_role=1, status='active'`.
- Keycloak master admin is bootstrap-only and stays separate from the business user.
- Bootstrap app user is pre-provisioned with email, first name, last name and `emailVerified=true`, so first login only forces password rotation instead of contractor-style email verification/profile completion.
- `keycloak_bootstrap` creates a realm user with username `KEYCLOAK_BOOTSTRAP_APP_USERNAME` and a temporary password.
- First successful login of that exact realm username binds it to local `superadmin`.
- No other Keycloak admin is auto-promoted to local superadmin.

## 8. Contractor self-registration flow

1. User clicks "Register as contractor" in web.
2. Browser is redirected to Keycloak registration.
3. After Keycloak completes registration and email verification, browser returns through backend callback.
4. Backend creates local `users` row with contractor role and `status='review'`, plus `user_auth_accounts` link.
5. Frontend redirects to `/account`, where the contractor can fill local profile/company data.
6. Admin later changes `users.status` to `active`.
7. Next login works without re-registration.

## 9. Existing users migration strategy

- Legacy login remains available temporarily.
- Existing users should be linked in a controlled way; normal Keycloak login does not auto-link arbitrary local usernames.
- Bootstrap superadmin is linked automatically only for the configured bootstrap username.
- Safe next step for staff migration:
  - create Keycloak account
  - create explicit `user_auth_accounts` binding
  - then disable legacy login for that user population

## 10. TG bot / notifications impact

- Existing TG bot and worker flows stay compatible because `tg_users` and `users.tg_user_id` were not removed.
- Current Telegram login flow still mints legacy web sessions during rollout.
- New user identity tables (`user_auth_accounts`, `user_contact_channels`) are ready for future TG linking migration.
- Recommended later step: migrate TG linkage to `provider='telegram'` and `channel_type='telegram'`.

## 11. Security notes

- Web login uses authorization code flow with PKCE.
- Backend validates Keycloak JWT signature, issuer and client binding (`aud` / `azp`).
- Refresh token stays in httpOnly cookie.
- Auto-provisioning of local users is limited to the self-registration flow.
- Bootstrap local superadmin binding is explicit and username-scoped.
- Frontend still does not decide business authorization.

## 12. Main files changed

- `docker-compose.yml`
- `backend/nginx.conf`
- `backend/env.example`
- `backend/app/core/config.py`
- `backend/app/core/auth_cookies.py`
- `backend/app/core/oidc_state_tokens.py`
- `backend/app/api/dependencies.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/ws.py`
- `backend/app/domain/authorization.py`
- `backend/app/core/uow.py`
- external DB migrations in `order_database/init/01-schema.sql`, `order_database/init/02-triggers.sql`, `order_database/flyway/sql/V1.0.1__iam_keycloak_contacts_unified.sql`
- `backend/app/services/keycloak_oidc.py`
- `backend/app/services/identity_sync.py`
- `backend/app/repositories/user_auth_accounts.py`
- `backend/app/repositories/user_contact_channels.py`
- `web/src/app/providers/AuthProvider.tsx`
- `web/src/app/routes/ProtectedRoute.tsx`
- `web/src/app/routes/RoleRoute.tsx`
- `web/src/app/routes/AppRoutes.tsx`
- `web/src/pages/auth/AuthPage.tsx`
- `web/src/pages/auth/AuthCallbackPage.tsx`
- `web/src/pages/auth/AccountStatePage.tsx`
- `infra/keycloak/realm-import/acom-offerdesk-realm.json`
- `infra/keycloak/bootstrap.sh`

## 13. Production notes

- Before disabling legacy login, perform controlled linking for existing staff users.
- In production, change `KEYCLOAK_START_COMMAND` from `start-dev` to `start`.
- Tighten reverse-proxy hostname/TLS settings and store bootstrap secrets outside Git-backed env files.
