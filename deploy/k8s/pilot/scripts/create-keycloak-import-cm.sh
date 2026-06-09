#!/usr/bin/env bash
set -euo pipefail
NS="${NAMESPACE:-acom-offer-desk-pilot}"
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
kubectl -n "$NS" create configmap keycloak-realm-import \
  --from-file="$REPO_ROOT/infra/keycloak/realm-import" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create configmap keycloak-bootstrap-scripts \
  --from-file=bootstrap.sh="$REPO_ROOT/infra/keycloak/bootstrap.sh" \
  --from-file=prepare-theme.sh="$REPO_ROOT/infra/keycloak/prepare-theme.sh" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NS" create configmap keycloak-themes-src \
  --from-file="$REPO_ROOT/infra/keycloak/themes/acom-offerdesk" \
  --dry-run=client -o yaml | kubectl apply -f -
echo "OK: keycloak-realm-import, keycloak-bootstrap-scripts, keycloak-themes-src"
