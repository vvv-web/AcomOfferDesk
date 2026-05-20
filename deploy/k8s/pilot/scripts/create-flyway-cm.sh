#!/usr/bin/env bash
set -euo pipefail
NS="${NAMESPACE:-acom-offer-desk-pilot}"
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
kubectl -n "$NS" create configmap flyway-sql-vtest \
  --from-file="$REPO_ROOT/deploy/order_database/flyway/sql" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "OK: configmap/flyway-sql-vtest"
