#!/usr/bin/env bash
# Workaround when cluster DNS (CoreDNS kubernetes plugin) is broken — use ClusterIP.
set -euo pipefail
NS="${NAMESPACE:-acom-offer-desk-pilot}"
FQDN="${PILOT_FQDN:-pilot.acom-offer-desk.ru}"
SCHEME="${PILOT_URL_SCHEME:-https}"

ip_of() {
  kubectl -n "$NS" get svc "$1" -o jsonpath='{.spec.clusterIP}'
}

PG_IP="$(ip_of postgres)"
RMQ_IP="$(ip_of rabbitmq 2>/dev/null || echo rabbitmq)"
MINIO_IP="$(ip_of minio 2>/dev/null || echo minio)"
KC_IP="$(ip_of keycloak 2>/dev/null || echo keycloak)"

PG_USER="${PILOT_PG_USER:-acom_pilot}"
PG_PASS="${PILOT_PG_PASSWORD:-pilot_pg_change_me}"
PG_DB="${PILOT_PG_DB:-order_database}"
RMQ_USER="${PILOT_RMQ_USER:-acom_rmq}"
RMQ_PASS="${PILOT_RMQ_PASS:-pilot_rmq_change_me}"

PG_SSL_QS="sslmode=verify-full&sslrootcert=/etc/ssl/postgres/ca.crt"
DATABASE_URL="postgresql+asyncpg://${PG_USER}:${PG_PASS}@${PG_IP}:5432/${PG_DB}?${PG_SSL_QS}"
FLYWAY_JDBC="jdbc:postgresql://${PG_IP}:5432/${PG_DB}?sslmode=verify-full&sslrootcert=/etc/ssl/postgres/ca.crt"
CELERY_BROKER="amqp://${RMQ_USER}:${RMQ_PASS}@${RMQ_IP}:5672/"

kubectl -n "$NS" patch secret acom-app-secrets --type merge -p "$(python3 - <<PY
import json
print(json.dumps({"data": {k: __import__('base64').b64encode(v.encode()).decode()
  for k,v in {
    "DATABASE_URL": "$DATABASE_URL",
    "FLYWAY_JDBC_URL": "$FLYWAY_JDBC",
    "CELERY_BROKER_URL": "$CELERY_BROKER",
    "KC_DB_URL_HOST": "$PG_IP",
    "S3_ENDPOINT": f"${MINIO_IP}:9000",
  }.items()}}))
PY
)"

kubectl -n "$NS" patch configmap acom-backend-env --type merge -p "$(python3 - <<PY
import json
print(json.dumps({"data": {
  "KEYCLOAK_INTERNAL_BASE_URL": f"http://${KC_IP}:8080/iam",
  "KEYCLOAK_PUBLIC_BASE_URL": "${SCHEME}://${FQDN}/iam",
  "KEYCLOAK_ISSUER_URL": "${SCHEME}://${FQDN}/iam/realms/acom-offerdesk",
  "KC_HOSTNAME": "${SCHEME}://${FQDN}/iam",
  "WEB_BASE_URL": "${SCHEME}://${FQDN}",
  "PUBLIC_BACKEND_BASE_URL": "${SCHEME}://${FQDN}",
}}))
PY
)"

echo "OK: patched secret+cm with ClusterIPs postgres=$PG_IP rabbitmq=$RMQ_IP minio=$MINIO_IP keycloak=$KC_IP"
