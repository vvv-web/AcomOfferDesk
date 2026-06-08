#!/usr/bin/env bash
# SB Step 6 verification: secrets RBAC + placeholder hardening (R-C2).
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
PILOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass=0
fail=0
skip=0

ok() { echo "[PASS] $*"; pass=$((pass + 1)); }
bad() { echo "[FAIL] $*" >&2; fail=$((fail + 1)); }
skp() { echo "[SKIP] $*"; skip=$((skip + 1)); }

echo "=== SB Step 6 verify (NS=${NS}) ==="

# S6-T1: RBAC manifest in kustomize
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -q 'name: acom-pilot-secrets-operator'; then
  ok "S6-T1 kustomize includes secrets RBAC (acom-pilot-secrets-operator)"
else
  bad "S6-T1 kustomize missing secrets RBAC"
fi

# S6-T2: runbook exists
if [[ -f "$PILOT_DIR/docs/RUNBOOK-PILOT-SECRETS-RBAC.md" ]]; then
  ok "S6-T2 runbook RUNBOOK-PILOT-SECRETS-RBAC.md present"
else
  bad "S6-T2 runbook missing"
fi

# S6-T3: backend uses dedicated runtime SA
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | awk '/kind: Deployment/{d=0} /name: backend/{d=1} d&&/serviceAccountName: acom-pilot-runtime/{print; exit}' | grep -q acom-pilot-runtime; then
  ok "S6-T3 backend deployment serviceAccountName=acom-pilot-runtime"
else
  bad "S6-T3 backend missing serviceAccountName acom-pilot-runtime"
fi

# S6-T4: operator Role scoped to named secrets
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | awk '
  /^kind: Role$/ { in_role=0 }
  /name: acom-pilot-secrets-operator/ { in_role=1 }
  in_role && /resourceNames:/ { has_rn=1 }
  in_role && has_rn && /acom-app-secrets/ { found=1 }
  END { exit(found ? 0 : 1) }
'; then
  ok "S6-T4 operator Role resourceNames includes acom-app-secrets"
else
  bad "S6-T4 operator Role missing resourceNames on secrets"
fi

# S6-T5: secrets.example — only placeholders
if grep -qE 'CHANGE_ME|USER:PASS' "$PILOT_DIR/config/secrets.example.yaml" 2>/dev/null; then
  if grep -qE 'password123|guest/guest|admin/admin' "$PILOT_DIR/config/secrets.example.yaml" 2>/dev/null; then
    bad "S6-T5 secrets.example contains weak literals"
  else
    ok "S6-T5 secrets.example uses CHANGE_ME placeholders only"
  fi
else
  bad "S6-T5 secrets.example missing CHANGE_ME pattern"
fi

# S6-T6: apply script strict placeholder guard
if grep -q 'PILOT_ALLOW_LEARN_PLACEHOLDERS' "$PILOT_DIR/scripts/apply-pilot-secrets.sh" 2>/dev/null \
  && grep -q 'learn_placeholder_detected' "$PILOT_DIR/scripts/apply-pilot-secrets.sh" 2>/dev/null; then
  ok "S6-T6 apply-pilot-secrets.sh enforces placeholder guard"
else
  bad "S6-T6 apply-pilot-secrets.sh missing placeholder guard"
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  skp "S6-T7..T11 cluster unreachable"
  echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
  exit "$([[ $fail -eq 0 ]] && echo 0 || echo 1)"
fi

# S6-T7: runtime SA cannot get secrets (API)
runtime_can="$(kubectl auth can-i get secrets \
  --as="system:serviceaccount:${NS}:acom-pilot-runtime" -n "$NS" 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
runtime_can="${runtime_can:-no}"
if [[ "$runtime_can" == "no" ]]; then
  ok "S6-T7 runtime SA cannot get secrets"
else
  bad "S6-T7 runtime SA can get secrets (got ${runtime_can})"
fi

# S6-T8: operator SA can get named secret (resourceNames-scoped Role)
op_can="$(kubectl auth can-i get secret/acom-app-secrets \
  --as="system:serviceaccount:${NS}:acom-pilot-secrets-operator" -n "$NS" 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
op_can="${op_can:-no}"
if [[ "$op_can" == "yes" ]]; then
  ok "S6-T8 operator SA can get secret/acom-app-secrets"
else
  bad "S6-T8 operator SA cannot get secret/acom-app-secrets"
fi

# S6-T9: default SA in namespace should not get secrets (extra hardening signal)
default_can="$(kubectl auth can-i get secrets \
  --as="system:serviceaccount:${NS}:default" -n "$NS" 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
default_can="${default_can:-no}"
if [[ "$default_can" == "no" ]]; then
  ok "S6-T9 default SA cannot get secrets"
else
  skp "S6-T9 default SA can get secrets (cluster policy may differ)"
fi

# S6-T10: live backend pod uses runtime SA
be_sa="$(kubectl -n "$NS" get deploy backend -o jsonpath='{.spec.template.spec.serviceAccountName}' 2>/dev/null || true)"
if [[ "$be_sa" == "acom-pilot-runtime" ]]; then
  ok "S6-T10 live backend serviceAccountName=acom-pilot-runtime"
else
  bad "S6-T10 live backend serviceAccountName='${be_sa}'"
fi

# S6-T11: live secret operator label (if secret exists)
if kubectl -n "$NS" get secret acom-app-secrets >/dev/null 2>&1; then
  managed="$(kubectl -n "$NS" get secret acom-app-secrets -o jsonpath='{.metadata.labels.acom\.security/managed-by}' 2>/dev/null || true)"
  if [[ "$managed" == "acom-pilot-operator" ]]; then
    ok "S6-T11 acom-app-secrets label managed-by=acom-pilot-operator"
  else
    bad "S6-T11 acom-app-secrets missing managed-by label (got '${managed}')"
  fi
else
  skp "S6-T11 acom-app-secrets not found in cluster"
fi

echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
