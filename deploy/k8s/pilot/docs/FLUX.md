# Flux GitOps — pilot pop-os

Ветка **`k8s-pilot-popos`**, remote **`origin` → `vvv-web/AcomOfferDesk`** (не `alexonderia`), кластер **k3s pop-os**, namespace **`acom-offer-desk-pilot`**.

Runbook: [`runbooks/README-flux-k3s-popos.md`](../../../../runbooks/README-flux-k3s-popos.md)

Фазы: [`../flux-phases/README.md`](../flux-phases/README.md)

## Post-Jobs без docker

| Job | Скрипт в pod |
|-----|----------------|
| `keycloak-init-deploy` | `/pilot-scripts/keycloak-init-deploy-k8s.sh` |
| `post-deploy-verify` | `/pilot-scripts/post-deploy-verify-k8s.sh` |

ConfigMap `pilot-job-scripts` создаётся в фазе **`pilot-base`**. VPS-скрипты `scripts/keycloak-init-deploy.sh` / `post-deploy-verify.sh` в Job **не** используются.

Оф. структура monorepo: [Flux repository structure](https://fluxcd.io/flux/guides/repository-structure/)
