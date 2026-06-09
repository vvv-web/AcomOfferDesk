#!/usr/bin/env bash
# Re-run Keycloak bootstrap when OIDC shows "Клиент не найден" (acom-web missing).
set -euo pipefail
NS="${NAMESPACE:-acom-offer-desk-pilot}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
export KUBECONFIG
kubectl -n "$NS" delete job keycloak-bootstrap --ignore-not-found=true --wait=true
kubectl -n "$NS" apply -f "$(dirname "$0")/../flux-phases/jobs-bootstrap/resources/jobs/keycloak-bootstrap.job.yaml"
kubectl -n "$NS" wait --for=condition=complete job/keycloak-bootstrap --timeout=900s
echo "OK: keycloak-bootstrap complete"
