#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
pass=0; fail=0
ok(){ echo "[PASS] $*"; pass=$((pass+1)); }
bad(){ echo "[FAIL] $*" >&2; fail=$((fail+1)); }
echo "=== SB Step 11 verify (R-H4) ==="
[[ -f "$REPO_ROOT/deploy/k8s/pilot/docs/R-H4-IB-PACKAGE.md" ]] && ok S11-T1 IB package doc || bad S11-T1
[[ -f "$REPO_ROOT/docs/security-sb-checklist.md" ]] && ok S11-T2 checklist || bad S11-T2
kubectl kustomize "$REPO_ROOT/deploy/k8s/pilot" >/dev/null 2>&1 && ok S11-T3 kustomize build || bad S11-T3
python3 "$REPO_ROOT/.github/scripts/check_k8s_pilot_security.py" --through-step 9 >/dev/null && ok S11-T4 security gate || bad S11-T4
echo "SUMMARY: pass=${pass} fail=${fail}"; [[ "$fail" -eq 0 ]]
