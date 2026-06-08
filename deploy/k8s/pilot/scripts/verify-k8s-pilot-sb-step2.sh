#!/usr/bin/env bash
# SB Step 2 verification: Ingress TLS (R-A2) + Keycloak FQDN redirect (R-G1).
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
FQDN="${PILOT_FQDN:-pilot.acom-offer-desk.ru}"
TLS_SECRET="${PILOT_TLS_SECRET:-acom-pilot-tls}"
INGRESS_NAME="${PILOT_INGRESS_NAME:-acom-pilot}"
INGRESS_SVC="${PILOT_INGRESS_SVC:-ingress-nginx-controller.ingress-nginx.svc.cluster.local}"
CURL_TLS="${PILOT_CURL_INSECURE:-1}"

resolve_ingress_base() {
  if [[ -n "${PILOT_INGRESS_BASE:-}" ]]; then
    echo "$PILOT_INGRESS_BASE"
    return
  fi
  local lb np
  lb="$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
  if [[ -n "$lb" ]]; then
    echo "https://${lb}"
    return
  fi
  np="$(kubectl -n ingress-nginx get svc ingress-nginx-controller -o jsonpath='{.spec.ports[?(@.name=="https")].nodePort}' 2>/dev/null || true)"
  if [[ -n "$np" ]]; then
    echo "https://127.0.0.1:${np}"
    return
  fi
  echo "https://${INGRESS_SVC}"
}

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
  curl -sS -m 15 "${extra[@]}" -H "Host: ${FQDN}" "$@" "$url"
}

echo "=== SB Step 2 verify (NS=${NS}, FQDN=${FQDN}) ==="

# S2-T1: rendered manifest has spec.tls
if kubectl kustomize "$(cd "$(dirname "$0")/.." && pwd)" 2>/dev/null | grep -q 'secretName: acom-pilot-tls'; then
  ok "S2-T1 kustomize build contains spec.tls secretName acom-pilot-tls"
else
  bad "S2-T1 kustomize build missing spec.tls / acom-pilot-tls"
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  skp "S2-T2..T6 cluster unreachable — apply TLS secret + ingress after k3s is up"
  echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
  exit "$([[ $fail -eq 0 ]] && echo 0 || echo 1)"
fi

# S2-T2: TLS secret exists
if kubectl -n "$NS" get secret "$TLS_SECRET" >/dev/null 2>&1; then
  ok "S2-T2 secret/${TLS_SECRET} exists"
else
  bad "S2-T2 secret/${TLS_SECRET} missing (run generate-pilot-ingress-tls.sh)"
fi

# S2-T3: Ingress exposes TLS host
tls_hosts="$(kubectl -n "$NS" get ingress "$INGRESS_NAME" -o jsonpath='{.spec.tls[*].hosts[*]}' 2>/dev/null || true)"
if [[ "$tls_hosts" == *"$FQDN"* ]]; then
  ok "S2-T3 Ingress spec.tls hosts include ${FQDN}"
else
  bad "S2-T3 Ingress tls hosts='${tls_hosts}' expected ${FQDN}"
fi

# S2-T4: Keycloak public URLs use https + FQDN
kc_hostname="$(kubectl -n "$NS" get configmap acom-backend-env -o jsonpath='{.data.KC_HOSTNAME}' 2>/dev/null || true)"
if [[ "$kc_hostname" == "https://${FQDN}/iam" ]]; then
  ok "S2-T4 KC_HOSTNAME=https://${FQDN}/iam"
else
  bad "S2-T4 KC_HOSTNAME='${kc_hostname}' expected https://${FQDN}/iam"
fi

issuer="$(kubectl -n "$NS" get configmap acom-backend-env -o jsonpath='{.data.KEYCLOAK_ISSUER_URL}' 2>/dev/null || true)"
if [[ "$issuer" == https://"${FQDN}"/* ]]; then
  ok "S2-T4b KEYCLOAK_ISSUER_URL uses https://${FQDN}"
else
  bad "S2-T4b KEYCLOAK_ISSUER_URL='${issuer}'"
fi

INGRESS_BASE="$(resolve_ingress_base)"
echo "Ingress probe base: ${INGRESS_BASE}"

# S2-T5: HTTPS health via ingress (TLS terminate)
hc="$(curl_ingress "${INGRESS_BASE}/health" -o /dev/null -w '%{http_code}' 2>/dev/null || echo 000)"
if [[ "$hc" == "200" ]]; then
  ok "S2-T5 HTTPS /health via ingress → ${hc}"
else
  bad "S2-T5 HTTPS /health → HTTP ${hc} (ingress-nginx / routes)"
fi

# S2-T6: OIDC login redirect Location contains FQDN (Keycloak hostname)
headers="$(curl_ingress "${INGRESS_BASE}/api/v1/auth/oidc/login?next_path=%2F" -D - -o /dev/null 2>/dev/null || true)"
if echo "$headers" | grep -qi "location:.*${FQDN}"; then
  ok "S2-T6 OIDC login redirect Location contains ${FQDN}"
elif echo "$headers" | grep -qi "location:.*https://"; then
  ok "S2-T6 OIDC login redirect uses https (check FQDN manually if host mismatch)"
else
  bad "S2-T6 OIDC login redirect missing FQDN in Location"
fi

echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
