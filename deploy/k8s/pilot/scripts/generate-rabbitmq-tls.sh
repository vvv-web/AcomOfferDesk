#!/usr/bin/env bash
# Self-signed RabbitMQ TLS (server + client) → Secret rabbitmq-tls (not in git). R-E2/E3.
set -euo pipefail

NS="${NAMESPACE:-acom-offer-desk-pilot}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout "$WORKDIR/ca_key.pem" -out "$WORKDIR/ca_certificate.pem" \
  -subj "/CN=acom-pilot-rabbitmq-ca"

openssl req -newkey rsa:2048 -nodes \
  -keyout "$WORKDIR/server_key.pem" -out "$WORKDIR/server.csr" \
  -subj "/CN=rabbitmq" \
  -addext "subjectAltName=DNS:rabbitmq,DNS:rabbitmq.${NS}.svc,DNS:rabbitmq.${NS}.svc.cluster.local"

openssl x509 -req -in "$WORKDIR/server.csr" -CA "$WORKDIR/ca_certificate.pem" -CAkey "$WORKDIR/ca_key.pem" \
  -CAcreateserial -out "$WORKDIR/server_certificate.pem" -days 365 \
  -copy_extensions copy

openssl req -newkey rsa:2048 -nodes \
  -keyout "$WORKDIR/client_key.pem" -out "$WORKDIR/client.csr" \
  -subj "/CN=acom-pilot-amqp-client"

openssl x509 -req -in "$WORKDIR/client.csr" -CA "$WORKDIR/ca_certificate.pem" -CAkey "$WORKDIR/ca_key.pem" \
  -CAcreateserial -out "$WORKDIR/client_certificate.pem" -days 365

kubectl -n "$NS" create secret generic rabbitmq-tls \
  --from-file=ca_certificate.pem="$WORKDIR/ca_certificate.pem" \
  --from-file=server_certificate.pem="$WORKDIR/server_certificate.pem" \
  --from-file=server_key.pem="$WORKDIR/server_key.pem" \
  --from-file=client_certificate.pem="$WORKDIR/client_certificate.pem" \
  --from-file=client_key.pem="$WORKDIR/client_key.pem" \
  --from-file=ca.crt="$WORKDIR/ca_certificate.pem" \
  --from-file=client.crt="$WORKDIR/client_certificate.pem" \
  --from-file=client.key="$WORKDIR/client_key.pem" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "OK: secret/rabbitmq-tls in namespace $NS"
