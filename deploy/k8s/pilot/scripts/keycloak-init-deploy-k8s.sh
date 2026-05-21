#!/bin/sh
# Keycloak permission gate/repair for K8s pilot (no docker compose).
set -eu

ENV_PATH="${PILOT_ENV_FILE:-/tmp/pilot.env}"
export KEYCLOAK_INTERNAL_BASE_URL="${KEYCLOAK_INTERNAL_BASE_URL:-http://keycloak:8080/iam}"
export PYTHONUNBUFFERED=1

python /pilot-scripts/write-pilot-env.py "${ENV_PATH}"

kc_check() {
  python -m app.scripts.check_keycloak_permission_model --env-file "${ENV_PATH}" "$@"
}

echo "KEYCLOAK_INIT_DEPLOY_K8S: deploy gate..."
if kc_check --deploy-gate; then
  echo "KEYCLOAK_INIT_DEPLOY_K8S: atomic permission model OK"
  exit 0
fi

echo "KEYCLOAK_INIT_DEPLOY_K8S: repair..."
kc_check --repair

echo "KEYCLOAK_INIT_DEPLOY_K8S: verify after repair..."
if kc_check --deploy-gate || kc_check; then
  echo "KEYCLOAK_INIT_DEPLOY_K8S: OK"
  exit 0
fi

echo "KEYCLOAK_INIT_DEPLOY_K8S: still failing — re-run keycloak-bootstrap Job if needed" >&2
exit 1
