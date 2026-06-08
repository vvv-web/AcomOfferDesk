#!/usr/bin/env bash
# SB Step 5 verification: prod profile app (R-B4) — readiness /health, /docs closed.
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
FQDN="${PILOT_FQDN:-pilot.acom-offer-desk.ru}"
PILOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CURL_TLS="${PILOT_CURL_INSECURE:-1}"

pass=0
fail=0
skip=0

ok() { echo "[PASS] $*"; pass=$((pass + 1)); }
bad() { echo "[FAIL] $*" >&2; fail=$((fail + 1)); }
skp() { echo "[SKIP] $*"; skip=$((skip + 1)); }

curl_ingress() {
  local url="$1"
  shift
  local extra=()
  if [[ "$CURL_TLS" == "1" ]]; then
    extra+=(-k)
  fi
  curl -sS -m 15 -o /dev/null -w "%{http_code}" "${extra[@]}" -H "Host: ${FQDN}" "$@" "$url"
}

echo "=== SB Step 5 verify (NS=${NS}, FQDN=${FQDN}) ==="

# S5-T1: kustomize backend readiness on /health
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | awk '/name: backend/{f=1} f&&/readinessProbe:/{rp=1} rp&&/path: \/health/{print; exit}' | grep -q '/health'; then
  ok "S5-T1 kustomize backend readinessProbe path=/health"
else
  bad "S5-T1 kustomize backend readinessProbe not on /health"
fi

# S5-T2: kustomize APP_ENV=production on backend
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -A1 'name: APP_ENV' | grep -q 'value: production'; then
  ok "S5-T2 kustomize backend APP_ENV=production"
else
  bad "S5-T2 kustomize backend missing APP_ENV=production"
fi

# S5-T3: ingress must not route /docs to backend
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -E 'path: /docs' >/dev/null 2>&1; then
  bad "S5-T3 ingress exposes /docs path"
else
  ok "S5-T3 ingress has no /docs route"
fi

# S5-T4: apply-pilot-secrets uses production APP_ENV
if grep -q 'APP_ENV: "production"' "$PILOT_DIR/scripts/apply-pilot-secrets.sh" 2>/dev/null; then
  ok "S5-T4 apply-pilot-secrets.sh APP_ENV=production"
else
  bad "S5-T4 apply-pilot-secrets.sh APP_ENV not production"
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  skp "S5-T5..T9 cluster unreachable"
  echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
  exit "$([[ $fail -eq 0 ]] && echo 0 || echo 1)"
fi

# S5-T5: live backend pod APP_ENV=production
be_pod="$(kubectl -n "$NS" get pods -l app=backend --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$be_pod" ]]; then
  skp "S5-T5 no running backend pod"
else
  app_env="$(kubectl -n "$NS" exec "$be_pod" -- printenv APP_ENV 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$app_env" == "production" ]]; then
    ok "S5-T5 backend pod APP_ENV=production (pod=${be_pod})"
  else
    bad "S5-T5 backend pod APP_ENV='${app_env}' expected production"
  fi
fi

# S5-T6: cluster-internal /docs closed (404)
be_ip="$(kubectl -n "$NS" get svc backend -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)"
if [[ -n "$be_ip" ]]; then
  docs_code="$(kubectl run curl-s5t6 --rm -i --restart=Never -n "$NS" \
    --image=curlimages/curl:8.5.0 --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65532}}}' \
    -- curl -sS -m 15 -o /dev/null -w "%{http_code}" "http://${be_ip}:8000/docs" 2>/dev/null | grep -oE '[0-9]{3}' | tail -1 || echo 000)"
  if [[ "$docs_code" == "404" ]]; then
    ok "S5-T6 in-cluster GET /docs → 404"
  else
    bad "S5-T6 in-cluster GET /docs → ${docs_code} (expected 404)"
  fi

  health_body="$(kubectl run curl-s5t6b --rm -i --restart=Never -n "$NS" \
    --image=curlimages/curl:8.5.0 --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65532}}}' \
    -- curl -sf -m 15 "http://${be_ip}:8000/health" 2>/dev/null || echo FAIL)"
  if [[ "$health_body" == *'"status":"ok"'* ]] || [[ "$health_body" == *"status\":\"ok\""* ]]; then
    ok "S5-T6b in-cluster GET /health → ok"
  else
    bad "S5-T6b in-cluster GET /health failed: ${health_body}"
  fi
else
  skp "S5-T6 backend service missing"
fi

# S5-T7: ingress /docs not reachable (404 from web default or nginx)
ingress_base=""
lb="$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
np="$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.spec.ports[?(@.name=="https")].nodePort}' 2>/dev/null || true)"
if [[ -n "$lb" ]]; then
  ingress_base="https://${lb}"
elif [[ -n "$np" ]]; then
  ingress_base="https://127.0.0.1:${np}"
fi

if [[ -n "$ingress_base" ]]; then
  docs_tmp="$(mktemp)"
  ext_docs="$(curl -sS -m 15 -k -H "Host: ${FQDN}" -o "$docs_tmp" -w "%{http_code}" "${ingress_base}/docs" 2>/dev/null || echo 000)"
  if [[ "$ext_docs" == "404" || "$ext_docs" == "403" ]]; then
    ok "S5-T7 ingress GET /docs → ${ext_docs} (backend OpenAPI not exposed)"
  elif [[ "$ext_docs" == "200" ]] && ! grep -qE 'swagger-ui|"openapi"' "$docs_tmp" 2>/dev/null; then
    ok "S5-T7 ingress GET /docs → 200 SPA (no Swagger/OpenAPI body)"
  else
    bad "S5-T7 ingress GET /docs exposes OpenAPI (code=${ext_docs})"
  fi
  rm -f "$docs_tmp"

  ext_health="$(curl_ingress "${ingress_base}/health")"
  if [[ "$ext_health" == "200" ]]; then
    ok "S5-T7b ingress GET /health → 200"
  else
    bad "S5-T7b ingress GET /health → ${ext_health} (expected 200)"
  fi
else
  skp "S5-T7 ingress endpoint not resolved"
fi

# S5-T8: readiness probe path on live deployment
rp_path="$(kubectl -n "$NS" get deploy backend -o jsonpath='{.spec.template.spec.containers[0].readinessProbe.httpGet.path}' 2>/dev/null || true)"
if [[ "$rp_path" == "/health" ]]; then
  ok "S5-T8 live deployment readinessProbe path=/health"
else
  bad "S5-T8 live readinessProbe path='${rp_path}'"
fi

echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
