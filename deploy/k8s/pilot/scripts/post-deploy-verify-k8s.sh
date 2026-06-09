#!/bin/sh
# Post-deploy gate for K8s pilot: ingress HTTP via curl + postgres/minio/keycloak (no docker).
set -eu

ENV_PATH="${PILOT_ENV_FILE:-/tmp/pilot.env}"
INGRESS_SVC="${PILOT_INGRESS_SVC:-ingress-nginx-controller.ingress-nginx.svc.cluster.local}"
INGRESS_HOST="${PILOT_INGRESS_HOST:-pilot.acom-offer-desk.ru}"
INGRESS_SCHEME="${PILOT_INGRESS_SCHEME:-https}"
INGRESS_BASE="${INGRESS_SCHEME}://${INGRESS_SVC}"
CURL_TLS_FLAG=""
if [ "${INGRESS_SCHEME}" = "https" ]; then
  CURL_TLS_FLAG="-k"
fi

export KEYCLOAK_INTERNAL_BASE_URL="${KEYCLOAK_INTERNAL_BASE_URL:-http://keycloak:8080/iam}"
export SMOKE_S3_ENDPOINT="${SMOKE_S3_ENDPOINT:-minio:9000}"
export SMOKE_SKIP_RABBITMQ="${SMOKE_SKIP_RABBITMQ:-true}"
export SMOKE_HTTP_TIMEOUT_SECONDS="${SMOKE_HTTP_TIMEOUT_SECONDS:-10}"
export PYTHONUNBUFFERED=1

python /pilot-scripts/write-pilot-env.py "${ENV_PATH}"

http_code() {
  curl -sS -m "${SMOKE_HTTP_TIMEOUT_SECONDS}" ${CURL_TLS_FLAG} -H "Host: ${INGRESS_HOST}" -o /dev/null -w "%{http_code}" "$1" || echo "000"
}

echo "=== post-deploy K8s: ingress ${INGRESS_SCHEME} (Host: ${INGRESS_HOST}) ==="
hc="$(http_code "${INGRESS_BASE}/health")"
if [ "${hc}" != "200" ]; then
  echo "[FAIL] Backend health: HTTP ${hc}" >&2
  exit 1
fi
echo "[OK] Backend health: HTTP ${hc}"

wc="$(http_code "${INGRESS_BASE}/")"
case "${wc}" in
  200|301|302|307|308) echo "[OK] Web root: HTTP ${wc}" ;;
  *) echo "[FAIL] Web root: HTTP ${wc}" >&2; exit 1 ;;
esac

ac="$(http_code "${INGRESS_BASE}/api/v1/auth/oidc/login?next_path=%2F")"
case "${ac}" in
  200|302|303|307|308|401|403) echo "[OK] API oidc login: HTTP ${ac}" ;;
  *) echo "[FAIL] API oidc login: HTTP ${ac}" >&2; exit 1 ;;
esac

oidc_body="$(mktemp)"
trap 'rm -f "${oidc_body}"' EXIT INT HUP TERM
if ! curl -sS -m "${SMOKE_HTTP_TIMEOUT_SECONDS}" ${CURL_TLS_FLAG} -L \
  -H "Host: ${INGRESS_HOST}" \
  -o "${oidc_body}" \
  "${INGRESS_BASE}/api/v1/auth/oidc/login?next_path=%2F"; then
  echo "[FAIL] Keycloak OIDC: could not follow login redirect" >&2
  exit 1
fi
if grep -qiE 'Клиент не найден|Client not found|client_not_found' "${oidc_body}"; then
  echo "[FAIL] Keycloak OIDC: acom-web missing (re-run keycloak-bootstrap Job)" >&2
  exit 1
fi
echo "[OK] Keycloak OIDC login page (acom-web client present)"

echo "=== post-deploy K8s: postgres + minio ==="
python - <<'PY'
import asyncio
import os
import re
import sys
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from app.scripts.smoke_services import Reporter, _check_postgres, _check_s3_minio, _load_env_file


def pilot_asyncpg_dsn(raw: str) -> str:
    """Pilot in-cluster Postgres: preserve sslmode/sslrootcert from DATABASE_URL (R-D2)."""
    dsn = re.sub(r"^postgresql\+[^:]+", "postgresql", raw.strip())
    parts = urlsplit(dsn)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith("ssl=")]
    if not any(k == "sslmode" for k, _ in query):
        query.append(("sslmode", "verify-full"))
    if not any(k == "sslrootcert" for k, _ in query):
        query.append(("sslrootcert", "/etc/ssl/postgres/ca.crt"))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


async def main() -> int:
    env_map = _load_env_file("/tmp/pilot.env")
    raw = os.environ.get("DATABASE_URL") or env_map.get("DATABASE_URL", "")
    if raw:
        env_map["SMOKE_DATABASE_URL"] = pilot_asyncpg_dsn(raw)
    reporter = Reporter()
    await _check_postgres(reporter, env_map)
    await _check_s3_minio(reporter, env_map)
    reporter.print()
    return 1 if reporter.has_failures() else 0

raise SystemExit(asyncio.run(main()))
PY

echo "=== post-deploy K8s: Keycloak permission model ==="
if python -m app.scripts.check_keycloak_permission_model --env-file "${ENV_PATH}"; then
  echo "POST_DEPLOY_VERIFY_K8S: all checks passed"
  exit 0
fi

echo "POST_DEPLOY_VERIFY_K8S: Keycloak model failed — repair" >&2
# --repair exits 1 when pre-repair checks fail; must not abort under set -e before final verify.
python -m app.scripts.check_keycloak_permission_model --env-file "${ENV_PATH}" --repair || true
if python -m app.scripts.check_keycloak_permission_model --env-file "${ENV_PATH}"; then
  echo "POST_DEPLOY_VERIFY_K8S: all checks passed after repair"
  exit 0
fi
echo "POST_DEPLOY_VERIFY_K8S: Keycloak check still failing" >&2
exit 1
