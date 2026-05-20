#!/usr/bin/env bash
set -euo pipefail
NS="${NAMESPACE:-acom-offer-desk-pilot}"
SCHEMA="${1:-/home/cpz_ai/Desktop/acome-offer-desk/order_database/init/01-schema.sql}"
kubectl -n "$NS" create configmap order-database-schema \
  --from-file=01-schema.sql="$SCHEMA" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "OK: configmap/order-database-schema"
