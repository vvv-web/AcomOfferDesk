#!/usr/bin/env bash
# Self-signed TLS для Postgres пилота → Secret postgres-tls (не в git).
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$WORKDIR/server.key" -out "$WORKDIR/server.crt" \
  -subj "/CN=postgres" \
  -addext "subjectAltName=DNS:postgres,DNS:postgres.${NS}.svc,DNS:postgres.${NS}.svc.cluster.local"
cp "$WORKDIR/server.crt" "$WORKDIR/ca.crt"

kubectl -n "$NS" create secret generic postgres-tls \
  --from-file=server.crt="$WORKDIR/server.crt" \
  --from-file=server.key="$WORKDIR/server.key" \
  --from-file=ca.crt="$WORKDIR/ca.crt" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "OK: secret/postgres-tls in namespace $NS"
