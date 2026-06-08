#!/usr/bin/env bash
# SB Step 7: CI invariants / R-C3 (no guest/guest in kustomize + examples).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
PILOT_DIR="${PILOT_DIR:-$REPO_ROOT/deploy/k8s/pilot}"
NS="${NAMESPACE:-acom-offer-desk-pilot}"

pass=0
fail=0
skip=0
ok() { echo "[PASS] $*"; pass=$((pass + 1)); }
bad() { echo "[FAIL] $*" >&2; fail=$((fail + 1)); }
skp() { echo "[SKIP] $*"; skip=$((skip + 1)); }

echo "=== SB Step 7 verify (R-C3) ==="

if [[ -f "$REPO_ROOT/.github/scripts/check_k8s_pilot_security.py" ]]; then
  ok "S7-T1 check_k8s_pilot_security.py exists"
else
  bad "S7-T1 missing check_k8s_pilot_security.py"
fi

if (cd "$REPO_ROOT" && python3 .github/scripts/check_k8s_pilot_security.py --pilot-dir "$PILOT_DIR" --through-step 7); then
  ok "S7-T2 security gate through step 7"
else
  bad "S7-T2 security gate through step 7"
fi

if kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -qi 'guest/guest'; then
  bad "S7-T3 kustomize contains guest/guest"
else
  ok "S7-T3 kustomize has no guest/guest"
fi

if grep -qE 'guest/guest|admin/admin' "$PILOT_DIR/config/secrets.example.yaml" 2>/dev/null; then
  bad "S7-T4 secrets.example weak literals"
else
  ok "S7-T4 secrets.example no weak literals"
fi

if grep -q 'check_k8s_pilot_security' "$REPO_ROOT/.github/workflows/ci.yml" 2>/dev/null; then
  ok "S7-T5 CI workflow references k8s pilot security gate"
else
  bad "S7-T5 CI workflow missing k8s pilot security job"
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  skp "S7-T6 live cluster health"
else
  not_ready="$(kubectl -n "$NS" get pods --field-selector=status.phase!=Succeeded,status.phase!=Failed -o json 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(sum(1 for i in d.get('items',[]) if not all(c.get('ready') for c in i.get('status',{}).get('containerStatuses',[]) or [{'ready':False}])))" 2>/dev/null || echo 1)"
  if [[ "${not_ready:-1}" == "0" ]]; then
    ok "S7-T6 all non-job pods Ready"
  else
    bad "S7-T6 pods not all Ready (count=${not_ready})"
  fi
fi

echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
