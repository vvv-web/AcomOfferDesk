#!/usr/bin/env bash
set -euo pipefail
NS="${NAMESPACE:-acom-offer-desk-pilot}"
INIT_DIR="${INIT_DIR:-/home/cpz_ai/Desktop/acome-offer-desk/order_database/init}"
kubectl -n "$NS" create configmap order-database-schema \
  --from-file=01-schema.sql="$INIT_DIR/01-schema.sql" \
  --from-file=03-bootstrap-admin.sql="$INIT_DIR/03-bootstrap-admin.sql" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "OK: configmap/order-database-schema (01-schema + 03-bootstrap-admin)"
