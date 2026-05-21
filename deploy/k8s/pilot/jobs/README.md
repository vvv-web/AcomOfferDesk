# Jobs — порядок выполнения (DAG)

Зеркало `.github/workflows/deploy.yml` и §1.3 roadmap.

## DAG (зависимости)

| # | Job | Зависит от | Exit criteria |
|---|-----|------------|---------------|
| 1 | `flyway-migrate` | Postgres Ready + TLS | `Complete`, таблица `user_auth_accounts` |
| 2 | `keycloak-db-prepare` | flyway (опционально) | схема Keycloak DB готова |
| 3 | Deploy `rabbitmq`, `minio` | namespace, secrets | Pods Ready |
| 4 | Deploy `keycloak` | (3), import в entrypoint | `/health/ready` |
| 5 | `keycloak-bootstrap` | keycloak Ready | логи без ERROR |
| 6 | `keycloak-user-role-sync` | (5) | Complete |
| 7 | Rollout `backend`, `web`, `notifications-worker` | (1), (3) | readiness `/health` |
| 8 | `keycloak-init-deploy` | (7) | skip или repair как VPS script |
| 9 | `post-deploy-verify` | Ingress + (7)(8) | exit 0, без `[FAIL]` |

## Файлы

| Файл | Назначение |
|------|------------|
| `flyway-migrate.job.yaml.example` | SQL из `deploy/order_database/flyway/sql` |
| `keycloak-db-prepare.job.yaml.example` | Подготовка БД Keycloak до import |
| `keycloak-bootstrap.job.yaml.example` | `infra/keycloak/bootstrap.sh` @ AOD_DEPLOY_SHA |
| `keycloak-user-role-sync.job.yaml.example` | sync ролей JWT |
| `keycloak-init-deploy.job.yaml` | `pilot-scripts/keycloak-init-deploy-k8s.sh` (Keycloak deploy gate/repair) |
| `post-deploy-verify.job.yaml` | `pilot-scripts/post-deploy-verify-k8s.sh` (ingress curl + postgres/minio/KC) |
| `keycloak-init-deploy.job.yaml.example` | VPS: `scripts/keycloak-init-deploy.sh` (docker) |
| `post-deploy-verify.job.yaml.example` | VPS: `scripts/post-deploy-verify.sh` (docker) |

## Повторный запуск

Jobs с `restartPolicy: Never` — при изменении только `AOD_DEPLOY_SHA` пересоздавать Job с новым именем suffix или `kubectl delete job` перед apply.
