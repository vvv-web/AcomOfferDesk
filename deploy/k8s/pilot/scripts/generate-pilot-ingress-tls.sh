#!/usr/bin/env bash
# Self-signed TLS для Ingress пилота → Secret acom-pilot-tls (не в git, R-A2 learn).
# Использование: PILOT_FQDN=pilot.acom-offer-desk.ru ./generate-pilot-ingress-tls.sh
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
FQDN="${PILOT_FQDN:-pilot.acom-offer-desk.ru}"
SECRET_NAME="${PILOT_TLS_SECRET:-acom-pilot-tls}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$WORKDIR/tls.key" -out "$WORKDIR/tls.crt" \
  -subj "/CN=${FQDN}" \
  -addext "subjectAltName=DNS:${FQDN}"

kubectl -n "$NS" create secret tls "$SECRET_NAME" \
  --cert="$WORKDIR/tls.crt" \
  --key="$WORKDIR/tls.key" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "OK: secret/${SECRET_NAME} for host ${FQDN} in namespace ${NS}"
