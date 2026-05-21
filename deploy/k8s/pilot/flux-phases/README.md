# Flux phases — порядок reconcile

Цепочка `dependsOn` в `clusters/k3s-popos/flux-system/`:

| Flux Kustomization | Kustomize path | Содержимое |
|--------------------|----------------|------------|
| `pilot-base` | `base/` | namespace, rabbitmq ConfigMap |
| `pilot-infra` | `infra/` | postgres, rabbitmq, minio, keycloak |
| `pilot-jobs-migrate` | `jobs-migrate/` | flyway-migrate Job |
| `pilot-jobs-bootstrap` | `jobs-bootstrap/` | keycloak-db-prepare, keycloak-bootstrap |
| `pilot-apps` | `apps/` | backend, web, worker, Ingress |
| `pilot-jobs-post` | `jobs-post/` | role-sync, init-deploy, post-deploy-verify |

Полный apply без Flux: `kubectl apply -k deploy/k8s/pilot` (без поэтапных Jobs).

Runbook: `runbooks/README-flux-k3s-popos.md`
