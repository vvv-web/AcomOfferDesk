#!/usr/bin/env bash
# SB Step 4 verification: Postgres TLS (R-D1, R-D2) + rabbitmq non-root (R-B2).
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
PILOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pass=0
fail=0
skip=0

ok() { echo "[PASS] $*"; pass=$((pass + 1)); }
bad() { echo "[FAIL] $*" >&2; fail=$((fail + 1)); }
skp() { echo "[SKIP] $*"; skip=$((skip + 1)); }

echo "=== SB Step 4 verify (NS=${NS}) ==="

# S4-T1: kustomize build has postgres ssl=on
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -q 'ssl=on'; then
  ok "S4-T1 kustomize postgres ssl=on"
else
  bad "S4-T1 kustomize missing postgres ssl=on"
fi

# S4-T2: rabbitmq securityContext in kustomize
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | awk '/name: rabbitmq/{f=1} f&&/runAsNonRoot: true/{print; exit}' | grep -q runAsNonRoot; then
  ok "S4-T2 kustomize rabbitmq runAsNonRoot"
else
  bad "S4-T2 kustomize rabbitmq missing runAsNonRoot securityContext"
fi

# S4-T3: backend mounts postgres-tls
if kubectl kustomize "$PILOT_DIR" 2>/dev/null | grep -q 'secretName: postgres-tls'; then
  ok "S4-T3 kustomize backend postgres-tls volume"
else
  bad "S4-T3 kustomize missing postgres-tls mount"
fi

# S4-T4: secrets.example verify-full
if grep -q 'sslmode=verify-full' "$PILOT_DIR/config/secrets.example.yaml" 2>/dev/null; then
  ok "S4-T4 secrets.example sslmode=verify-full"
else
  bad "S4-T4 secrets.example missing verify-full"
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  skp "S4-T5..T10 cluster unreachable"
  echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
  exit "$([[ $fail -eq 0 ]] && echo 0 || echo 1)"
fi

# S4-T5: postgres SHOW ssl=on
pg_pod="$(kubectl -n "$NS" get pods -l app=postgres --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$pg_pod" ]]; then
  skp "S4-T5 no running postgres pod"
else
  ssl_val="$(kubectl -n "$NS" exec "$pg_pod" -- psql -U acom_pilot -d order_database -tAc 'SHOW ssl' 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$ssl_val" == "on" ]]; then
    ok "S4-T5 postgres SHOW ssl=on (pod=${pg_pod})"
  else
    bad "S4-T5 postgres SHOW ssl='${ssl_val}' expected on"
  fi
fi

# S4-T6: Secret postgres-tls exists
if kubectl -n "$NS" get secret postgres-tls >/dev/null 2>&1; then
  ok "S4-T6 secret/postgres-tls exists"
else
  bad "S4-T6 secret/postgres-tls missing (run generate-postgres-tls.sh)"
fi

# S4-T7: DATABASE_URL contains verify-full
db_url="$(kubectl -n "$NS" get secret acom-app-secrets -o jsonpath='{.data.DATABASE_URL}' 2>/dev/null | base64 -d 2>/dev/null || true)"
if [[ "$db_url" == *sslmode=verify-full* ]]; then
  ok "S4-T7 acom-app-secrets DATABASE_URL sslmode=verify-full"
else
  bad "S4-T7 DATABASE_URL missing verify-full (re-run apply-pilot-secrets.sh)"
fi

if [[ "$db_url" == *sslrootcert=* ]]; then
  ok "S4-T7b DATABASE_URL sslrootcert present"
else
  bad "S4-T7b DATABASE_URL missing sslrootcert"
fi

# S4-T8: rabbitmq runs non-root (uid != 0)
rmq_pod="$(kubectl -n "$NS" get pods -l app=rabbitmq --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$rmq_pod" ]]; then
  skp "S4-T8 no running rabbitmq pod"
else
  rmq_uid="$(kubectl -n "$NS" exec "$rmq_pod" -- id -u 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ -n "$rmq_uid" && "$rmq_uid" != "0" ]]; then
    ok "S4-T8 rabbitmq pod uid=${rmq_uid} (non-root)"
  else
    bad "S4-T8 rabbitmq pod uid='${rmq_uid}' expected non-root"
  fi
fi

# S4-T9: backend /health after TLS (app still works)
be_ip="$(kubectl -n "$NS" get svc backend -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)"
if [[ -n "$be_ip" ]]; then
  hc="$(kubectl run curl-s4t9 --rm -i --restart=Never -n "$NS" \
    --image=curlimages/curl:8.5.0 --overrides='{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":65532}}}' \
    -- curl -sf -m 15 "http://${be_ip}:8000/health" 2>/dev/null || echo FAIL)"
  if [[ "$hc" == *'"status":"ok"'* ]] || [[ "$hc" == *"status\":\"ok\""* ]]; then
    ok "S4-T9 backend /health OK with Postgres TLS"
  else
    bad "S4-T9 backend /health failed: ${hc}"
  fi
else
  skp "S4-T9 backend service missing"
fi

# S4-T10: asyncpg verify-full smoke from backend pod
be_pod="$(kubectl -n "$NS" get pods -l app=backend --field-selector=status.phase=Running \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
if [[ -z "$be_pod" ]]; then
  skp "S4-T10 no backend pod for DB smoke"
else
  if kubectl -n "$NS" exec "$be_pod" -- python - <<'PY' 2>/dev/null
import asyncio, os, re
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit

async def main():
    raw = os.environ.get("DATABASE_URL", "")
    dsn = re.sub(r"^postgresql\+[^:]+", "postgresql", raw.strip())
    parts = urlsplit(dsn)
    q = [(k, v) for k, v in parse_qsl(parts.query) if not k.lower().startswith("ssl=")]
    if not any(k == "sslmode" for k, _ in q):
        q.append(("sslmode", "verify-full"))
    dsn = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))
    import asyncpg
    conn = await asyncpg.connect(dsn, timeout=10)
    val = await conn.fetchval("SHOW ssl")
    await conn.close()
    assert val == "on", val

asyncio.run(main())
PY
  then
    ok "S4-T10 backend asyncpg verify-full connects (SHOW ssl=on)"
  else
    bad "S4-T10 backend asyncpg verify-full connection failed"
  fi
fi

echo "SUMMARY: pass=${pass} fail=${fail} skip=${skip}"
[[ "$fail" -eq 0 ]]
