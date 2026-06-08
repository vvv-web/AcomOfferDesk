#!/usr/bin/env bash
# SB Step 9: MinIO TLS + S3 verify (R-F1, R-F2).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
PILOT_DIR="$REPO_ROOT/deploy/k8s/pilot"
NS="${NAMESPACE:-acom-offer-desk-pilot}"
pass=0; fail=0; skip=0
ok(){ echo "[PASS] $*"; pass=$((pass+1)); }
bad(){ echo "[FAIL] $*" >&2; fail=$((fail+1)); }
skp(){ echo "[SKIP] $*"; skip=$((skip+1)); }
echo "=== SB Step 9 verify ==="
(cd "$REPO_ROOT" && python3 .github/scripts/check_k8s_pilot_security.py --through-step 9) && ok S9-T1 security gate step9 || bad S9-T1
grep -q 'minio-tls' "$PILOT_DIR/workloads/minio.yaml" && ok S9-T2 minio-tls mount || bad S9-T2
grep -q 'S3_CA_CERT_PATH' "$REPO_ROOT/backend/app/core/config.py" && ok S9-T3 S3_CA_CERT_PATH in config || bad S9-T3
grep -q 'cert_reqs' "$REPO_ROOT/backend/app/infrastructure/minio_client.py" && ok S9-T4 minio CA verify in code || bad S9-T4
grep -q 'S3_SECURE="true"' "$PILOT_DIR/scripts/apply-pilot-secrets.sh" && ok S9-T5 S3_SECURE true in apply || bad S9-T5
if kubectl cluster-info >/dev/null 2>&1; then
  kubectl -n "$NS" get secret minio-tls >/dev/null 2>&1 && ok S9-T6 secret minio-tls || bad S9-T6
  sec="$(kubectl -n "$NS" get secret acom-app-secrets -o jsonpath='{.data.S3_SECURE}' 2>/dev/null | base64 -d 2>/dev/null || true)"
  [[ "$sec" == "true" ]] && ok S9-T7 live S3_SECURE || bad "S9-T7 S3_SECURE=${sec}"
else skp S9-T6..T7
fi
echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
