#!/usr/bin/env bash
# Создаёт Secret/ConfigMap пилота. Значения — learn-only placeholders (не prod).
# При наличии backend/.env (chmod 600) — можно расширить: --from-env-file=...
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"

# Learn defaults — пользователь должен заменить перед SB-пилотом
PG_USER="${PILOT_PG_USER:-acom_pilot}"
PG_PASS="${PILOT_PG_PASSWORD:-pilot_pg_change_me}"
PG_DB="${PILOT_PG_DB:-order_database}"
KC_BOOT="${PILOT_KC_BOOTSTRAP_PASS:-pilot_kc_bootstrap_change_me}"
APP_BOOT="${PILOT_APP_BOOTSTRAP_PASS:-pilot_app_superadmin_change_me}"
JWT_SEC="${PILOT_JWT_SECRET:-pilot_jwt_secret_change_me_32chars_min}"
RMQ_USER="${PILOT_RMQ_USER:-acom_rmq}"
RMQ_PASS="${PILOT_RMQ_PASS:-pilot_rmq_change_me}"
MINIO_USER="${PILOT_MINIO_USER:-acom_minio}"
MINIO_PASS="${PILOT_MINIO_PASS:-pilot_minio_change_me}"

FQDN="${PILOT_FQDN:-pilot.acom-offer-desk.ru}"
SCHEME="${PILOT_URL_SCHEME:-https}"
# Pilot learn: sslmode=require (IP/DNS workaround); §8.2 → verify-full + CA
DATABASE_URL="postgresql+asyncpg://${PG_USER}:${PG_PASS}@postgres:5432/${PG_DB}?sslmode=require"
FLYWAY_JDBC="jdbc:postgresql://postgres:5432/${PG_DB}?sslmode=require"
CELERY_BROKER="amqp://${RMQ_USER}:${RMQ_PASS}@rabbitmq.${NS}.svc.cluster.local:5672/"

kubectl -n "$NS" create secret generic acom-app-secrets \
  --from-literal=POSTGRES_USER="$PG_USER" \
  --from-literal=POSTGRES_PASSWORD="$PG_PASS" \
  --from-literal=POSTGRES_DB="$PG_DB" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=FLYWAY_JDBC_URL="$FLYWAY_JDBC" \
  --from-literal=FLYWAY_USER="$PG_USER" \
  --from-literal=FLYWAY_PASSWORD="$PG_PASS" \
  --from-literal=JWT_SECRET="$JWT_SEC" \
  --from-literal=JWT_ALGORITHM="HS256" \
  --from-literal=KEYCLOAK_ADMIN="kc_bootstrap_admin" \
  --from-literal=KEYCLOAK_ADMIN_PASSWORD="$KC_BOOT" \
  --from-literal=KC_BOOTSTRAP_ADMIN_USERNAME="kc_bootstrap_admin" \
  --from-literal=KC_BOOTSTRAP_ADMIN_PASSWORD="$KC_BOOT" \
  --from-literal=KEYCLOAK_BOOTSTRAP_USERNAME="superadmin" \
  --from-literal=KEYCLOAK_BOOTSTRAP_PASSWORD="$APP_BOOT" \
  --from-literal=KEYCLOAK_BOOTSTRAP_APP_PASSWORD="$APP_BOOT" \
  --from-literal=KEYCLOAK_ADMIN_CLIENT_SECRET="${PILOT_KC_ADMIN_CLIENT_SECRET:-pilot_kc_admin_client_secret_change_me}" \
  --from-literal=KEYCLOAK_ENABLED="true" \
  --from-literal=KEYCLOAK_REALM="acom-offerdesk" \
  --from-literal=KEYCLOAK_API_CLIENT_ID="acom-api" \
  --from-literal=KEYCLOAK_WEB_CLIENT_ID="acom-web" \
  --from-literal=RABBITMQ_DEFAULT_USER="$RMQ_USER" \
  --from-literal=RABBITMQ_DEFAULT_PASS="$RMQ_PASS" \
  --from-literal=CELERY_BROKER_URL="$CELERY_BROKER" \
  --from-literal=MINIO_ROOT_USER="$MINIO_USER" \
  --from-literal=MINIO_ROOT_PASSWORD="$MINIO_PASS" \
  --from-literal=S3_ENDPOINT="minio:9000" \
  --from-literal=S3_ACCESS_KEY="$MINIO_USER" \
  --from-literal=S3_SECRET_KEY="$MINIO_PASS" \
  --from-literal=S3_BUCKET="acom-offer-desk" \
  --from-literal=S3_SECURE="false" \
  --from-literal=EMAIL_ADDRESS="pilot@example.com" \
  --from-literal=EMAIL_APP_PASSWORD="pilot_email_change_me" \
  --from-literal=SMTP_HOST="smtp.example.com" \
  --from-literal=SMTP_PORT="465" \
  --from-literal=EMAIL_VERIFICATION_SECRET="pilot_email_verify_secret_change_me" \
  --from-literal=EMAIL_REPLY_SECRET="pilot_email_reply_secret_change_me" \
  --from-literal=TG_LINK_SECRET="pilot_tg_link_secret_change_me" \
  --from-literal=KC_DB=postgres \
  --from-literal=KC_DB_URL_HOST=postgres \
  --from-literal=KC_DB_URL_PORT=5432 \
  --from-literal=KC_DB_URL_DATABASE="$PG_DB" \
  --from-literal=KC_DB_USERNAME="$PG_USER" \
  --from-literal=KC_DB_PASSWORD="$PG_PASS" \
  --from-literal=KC_DB_SCHEMA=keycloak \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NS" apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: acom-backend-env
  namespace: ${NS}
data:
  APP_ENV: "pilot"
  KEYCLOAK_REALM: "acom-offerdesk"
  KEYCLOAK_INTERNAL_BASE_URL: "http://keycloak:8080/iam"
  KEYCLOAK_PUBLIC_BASE_URL: "${SCHEME}://${FQDN}/iam"
  KEYCLOAK_ISSUER_URL: "${SCHEME}://${FQDN}/iam/realms/acom-offerdesk"
  WEB_BASE_URL: "${SCHEME}://${FQDN}"
  PUBLIC_BACKEND_BASE_URL: "${SCHEME}://${FQDN}"
  KC_HTTP_RELATIVE_PATH: "/iam"
  KC_HOSTNAME: "${SCHEME}://${FQDN}/iam"
  KC_HOSTNAME_STRICT: "true"
  KC_HOSTNAME_STRICT_HTTPS: "true"
  KC_PROXY_HEADERS: "xforwarded"
  KEYCLOAK_START_COMMAND: "start"
  S3_SECURE: "false"
EOF

echo "OK: acom-app-secrets + acom-backend-env (learn placeholders — см. STATE.md blockers)"
