#!/usr/bin/env bash
# Re-run Keycloak bootstrap when OIDC shows "Клиент не найден" (acom-web missing).
# After bootstrap, reconcile app.* composite roles via backend repair (kcadm stdin bug in sync_composite_role).
set -euo pipefail
NS="${NAMESPACE:-acom-offer-desk-pilot}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
export KUBECONFIG
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
"$SCRIPT_DIR/create-keycloak-import-cm.sh"
kubectl -n "$NS" delete job keycloak-bootstrap --ignore-not-found=true --wait=true
kubectl -n "$NS" apply -f "$SCRIPT_DIR/../flux-phases/jobs-bootstrap/resources/jobs/keycloak-bootstrap.job.yaml"
kubectl -n "$NS" wait --for=condition=complete job/keycloak-bootstrap --timeout=900s
echo "OK: keycloak-bootstrap complete"
echo "Reconciling Keycloak permission composites (check_keycloak_permission_model --repair)..."
kubectl -n "$NS" exec deploy/backend -- sh -c '
python3 <<"PY"
import os
keys_prefix = ("KEYCLOAK", "DATABASE", "APP_", "BACKEND", "WEB_", "PUBLIC_", "SMTP_", "REGISTRATION_")
with open("/tmp/pilot.env", "w") as f:
    for k, v in sorted(os.environ.items()):
        if k.startswith(keys_prefix):
            f.write(f"{k}={v}\n")
PY
python -m app.scripts.check_keycloak_permission_model --env-file /tmp/pilot.env --repair
python -m app.scripts.check_keycloak_permission_model --env-file /tmp/pilot.env
'
echo "OK: Keycloak bootstrap + permission model repair"
