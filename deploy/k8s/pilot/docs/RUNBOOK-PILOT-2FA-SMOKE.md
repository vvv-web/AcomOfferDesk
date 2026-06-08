# Pilot Keycloak 2FA smoke (R-G2)

**Namespace:** `acom-offer-desk-pilot` · **Realm:** `acom-offerdesk`

## Цель

Проверить, что для контрольной учётки можно включить **CONFIGURE_TOTP** (2FA) без падения Keycloak.

## Preconditions

- `deploy/keycloak` **1/1 Running**
- Ingress `https://pilot.acom-offer-desk.ru/iam` отвечает

## Smoke (read-only)

```bash
export NS=acom-offer-desk-pilot
curl -k -sS -o /dev/null -w "%{http_code}\n" -H "Host: pilot.acom-offer-desk.ru" \
  https://127.0.0.1/iam/realms/acom-offerdesk/.well-known/openid-configuration
```

Ожидаемо: **200**.

## Включение TOTP для контрольной роли (оператор)

В pod Keycloak (пароль bootstrap — только из Secret на хосте, не в git):

```bash
kubectl -n "$NS" exec -it deploy/keycloak -- bash
/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080/iam \
  --realm master --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"
/opt/keycloak/bin/kcadm.sh update realms/acom-offerdesk -s otpPolicyType=totp -s otpPolicyAlgorithm=HmacSHA1
/opt/keycloak/bin/kcadm.sh update authentication/required-actions/CONFIGURE_TOTP -s enabled=true -s defaultAction=false
```

Пользователь с контрольной ролью: Account Console → **Signing in** → настроить Authenticator app.

Оф. дока: https://www.keycloak.org/docs/latest/server_admin/#_otp_policies
