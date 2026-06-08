#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
pass=0; fail=0
ok(){ echo "[PASS] $*"; pass=$((pass+1)); }
bad(){ echo "[FAIL] $*" >&2; fail=$((fail+1)); }
echo "=== SB Step 12 verify (R-J2) ==="
[[ -f "$REPO_ROOT/docs/security/security-upload-k8s-pilot.md" ]] && ok S12-T1 upload plan doc || bad S12-T1
grep -q "R-J2" "$REPO_ROOT/docs/security/security-upload-k8s-pilot.md" && ok S12-T2 references R-J2 || bad S12-T2
grep -q "S3_SECURE" "$REPO_ROOT/docs/security/security-upload-k8s-pilot.md" && ok S12-T3 links MinIO TLS || bad S12-T3
echo "SUMMARY: pass=${pass} fail=${fail}"; [[ "$fail" -eq 0 ]]
