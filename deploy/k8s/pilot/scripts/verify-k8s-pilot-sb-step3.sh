#!/usr/bin/env bash
# SB Step 3 verification: NetworkPolicy (R-A3, R-D3).
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
PILOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass=0
fail=0
skip=0

ok() { echo "[PASS] $*"; pass=$((pass + 1)); }
bad() { echo "[FAIL] $*" >&2; fail=$((fail + 1)); }
skp() { echo "[SKIP] $*"; skip=$((skip + 1)); }

echo "=== SB Step 3 verify (NS=${NS}) ==="

# S3-T1: kustomize build includes NetworkPolicy
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -q 'kind: NetworkPolicy'; then
  ok "S3-T1 kustomize build contains NetworkPolicy"
else
  bad "S3-T1 kustomize build missing NetworkPolicy"
fi

if ! kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -q 'name: deny-data-egress'; then
  bad "S3-T1b kustomize missing deny-data-egress"
else
  ok "S3-T1b kustomize contains deny-data-egress"
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  skp "S3-T2..T7 cluster unreachable"
  echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
  exit "$([[ $fail -eq 0 ]] && echo 0 || echo 1)"
fi

# S3-T2: at least one NetworkPolicy in namespace
np_count="$(kubectl -n "$NS" get networkpolicy --no-headers 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${np_count:-0}" -ge 1 ]]; then
  ok "S3-T2 kubectl get networkpolicy count=${np_count} (>=1)"
else
  bad "S3-T2 networkpolicy count=${np_count} expected >=1"
fi

# S3-T3: deny-data-egress exists with egress policy
if kubectl -n "$NS" get networkpolicy deny-data-egress >/dev/null 2>&1; then
  ok "S3-T3 NetworkPolicy/deny-data-egress exists"
else
  bad "S3-T3 NetworkPolicy/deny-data-egress missing"
fi

egress_types="$(kubectl -n "$NS" get networkpolicy deny-data-egress -o jsonpath='{.spec.policyTypes}' 2>/dev/null || true)"
if [[ "$egress_types" == *"Egress"* ]]; then
  ok "S3-T3b deny-data-egress policyTypes include Egress"
else
  bad "S3-T3b deny-data-egress policyTypes='${egress_types}'"
fi

# S3-T4: data-tier pods labeled (Running only — ignore stale Completed pods)
for app in postgres rabbitmq minio; do
  tier="$(kubectl -n "$NS" get pods -l "app=${app}" --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.labels.acom\.security/tier}' 2>/dev/null || true)"
  if [[ "$tier" == "data" ]]; then
    ok "S3-T4 pod app=${app} acom.security/tier=data"
  else
    bad "S3-T4 pod app=${app} tier='${tier}' expected data"
  fi
done

# S3-T5: app-tier pods labeled
for app in backend web notifications-worker keycloak; do
  tier="$(kubectl -n "$NS" get pods -l "app=${app}" --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.labels.acom\.security/tier}' 2>/dev/null || true)"
  if [[ "$tier" == "app" ]]; then
    ok "S3-T5 pod app=${app} acom.security/tier=app"
  else
    bad "S3-T5 pod app=${app} tier='${tier}' expected app"
  fi
done

# S3-T6: data-tier egress to internet blocked (wget/curl to 1.1.1.1)
data_pod="$(kubectl -n "$NS" get pods -l 'acom.security/tier=data' --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$data_pod" ]]; then
  skp "S3-T6 no data-tier pod for egress probe"
else
  if kubectl -n "$NS" exec "$data_pod" -- sh -c 'command -v wget >/dev/null && wget -q -T 3 -O /dev/null http://1.1.1.1 2>/dev/null || (command -v curl >/dev/null && curl -sf -m 3 http://1.1.1.1 >/dev/null)'; then
    bad "S3-T6 data pod ${data_pod} reached internet (1.1.1.1) — egress not denied"
  else
    ok "S3-T6 data pod ${data_pod} cannot reach internet (egress deny)"
  fi
fi

# S3-T7: app still reaches data (postgres ping via backend health)
be_ip="$(kubectl -n "$NS" get svc backend -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)"
if [[ -n "$be_ip" ]]; then
  hc="$(kubectl run curl-s3t7 --rm -i --restart=Never -n "$NS" \
    --image=curlimages/curl:8.5.0 --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65532}}}' \
    -- curl -sf -m 10 "http://${be_ip}:8000/health" 2>/dev/null || echo FAIL)"
  if [[ "$hc" == *'"status":"ok"'* ]] || [[ "$hc" == *"status\":\"ok\""* ]]; then
    ok "S3-T7 backend /health OK after NetworkPolicy"
  else
    bad "S3-T7 backend /health failed after NetworkPolicy"
  fi
else
  skp "S3-T7 backend service missing"
fi

echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
