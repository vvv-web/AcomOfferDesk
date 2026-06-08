#!/usr/bin/env bash
# Self-signed MinIO TLS → Secret minio-tls (not in git). R-F1.
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$WORKDIR/private.key" -out "$WORKDIR/public.crt" \
  -subj "/CN=minio" \
  -addext "subjectAltName=DNS:minio,DNS:minio.${NS}.svc,DNS:minio.${NS}.svc.cluster.local"
cp "$WORKDIR/public.crt" "$WORKDIR/ca.crt"

kubectl -n "$NS" create secret generic minio-tls \
  --from-file=private.key="$WORKDIR/private.key" \
  --from-file=public.crt="$WORKDIR/public.crt" \
  --from-file=ca.crt="$WORKDIR/ca.crt" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "OK: secret/minio-tls in namespace $NS"
