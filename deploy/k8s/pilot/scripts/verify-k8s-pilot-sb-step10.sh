#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
NS="${NAMESPACE:-acom-offer-desk-pilot}"
pass=0; fail=0
ok(){ echo "[PASS] $*"; pass=$((pass+1)); }
bad(){ echo "[FAIL] $*" >&2; fail=$((fail+1)); }
echo "=== SB Step 10 verify (R-G2, R-B1) ==="
[[ -f "$REPO_ROOT/deploy/k8s/pilot/docs/RUNBOOK-PILOT-2FA-SMOKE.md" ]] && ok S10-T1 2FA runbook || bad S10-T1
grep -q CONFIGURE_TOTP "$REPO_ROOT/deploy/k8s/pilot/docs/RUNBOOK-PILOT-2FA-SMOKE.md" && ok S10-T2 runbook mentions CONFIGURE_TOTP || bad S10-T2
if kubectl cluster-info >/dev/null 2>&1; then
  kubectl -n "$NS" get deploy keycloak -o jsonpath='{.status.readyReplicas}' 2>/dev/null | grep -q '^1$' && ok S10-T3 keycloak 1/1 || bad S10-T3
  code=$(curl -k -sS -m 8 -o /dev/null -w "%{http_code}" -H "Host: pilot.acom-offer-desk.ru" \
    "https://127.0.0.1/iam/realms/acom-offerdesk/.well-known/openid-configuration" 2>/dev/null || echo 000)
  [[ "$code" == "200" ]] && ok S10-T4 issuer HTTP 200 || bad "S10-T4 issuer code=$code"
else bad S10-T3 cluster unreachable
fi
echo "SUMMARY: pass=${pass} fail=${fail}"; [[ "$fail" -eq 0 ]]
