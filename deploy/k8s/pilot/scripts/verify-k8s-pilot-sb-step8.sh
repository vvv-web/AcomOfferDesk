#!/usr/bin/env bash
# SB Step 8: RabbitMQ AMQPS (R-E1, R-E2, R-E3).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
PILOT_DIR="$REPO_ROOT/deploy/k8s/pilot"
NS="${NAMESPACE:-acom-offer-desk-pilot}"
pass=0; fail=0; skip=0
ok(){ echo "[PASS] $*"; pass=$((pass+1)); }
bad(){ echo "[FAIL] $*" >&2; fail=$((fail+1)); }
skp(){ echo "[SKIP] $*"; skip=$((skip+1)); }
echo "=== SB Step 8 verify ==="
(cd "$REPO_ROOT" && python3 .github/scripts/check_k8s_pilot_security.py --through-step 8) && ok S8-T1 security gate step8 || bad S8-T1 security gate step8
if kubectl kustomize "$PILOT_DIR/flux-phases/infra" 2>/dev/null | grep -q 'port: 5672'; then bad S8-T2 no plaintext 5672 in infra; else ok S8-T2 no plaintext 5672; fi
if grep -q 'listeners.tcp = none' "$PILOT_DIR/config/rabbitmq-configmap.yaml"; then ok S8-T3 rabbitmq listeners.tcp=none; else bad S8-T3; fi
if grep -q 'amqps://' "$PILOT_DIR/scripts/apply-pilot-secrets.sh"; then ok S8-T4 apply uses amqps; else bad S8-T4; fi
if [[ -x "$PILOT_DIR/scripts/generate-rabbitmq-tls.sh" ]]; then ok S8-T5 tls generator; else bad S8-T5; fi
if kubectl cluster-info >/dev/null 2>&1; then
  if kubectl -n "$NS" get secret rabbitmq-tls >/dev/null 2>&1; then ok S8-T6 secret rabbitmq-tls; else bad S8-T6 secret rabbitmq-tls; fi
  svc="$(kubectl -n "$NS" get svc rabbitmq -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || true)"
  if [[ "$svc" == "5671" ]]; then ok S8-T7 live svc port 5671; else bad "S8-T7 live svc port=${svc}"; fi
  url="$(kubectl -n "$NS" get secret acom-app-secrets -o jsonpath='{.data.RABBITMQ_URL}' 2>/dev/null | base64 -d 2>/dev/null || true)"
  if [[ "$url" == amqps://* ]]; then ok S8-T8 live RABBITMQ_URL amqps; else bad "S8-T8 RABBITMQ_URL=${url}"; fi
else skp S8-T6..T8 cluster
fi
echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
