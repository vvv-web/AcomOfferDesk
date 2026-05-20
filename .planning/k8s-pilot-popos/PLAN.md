# PLAN — K8s pilot pop-os (steps 0–12)

Согласовано с [kubernetes-migration-roadmap.md](../../docs/operations/kubernetes-migration-roadmap.md) v0.5.  
**Фаза A:** функциональный пилот (§8.1a). **Фаза B (позже):** SB hardening (§8.2).

Каждый шаг: одно действие → проверка → **стоп для OK пользователя** → следующий шаг.

| # | Название | Действие (кратко) | Проверка | DoD |
|---|----------|-------------------|----------|-----|
| **0** | Preflight | `git fetch upstream test`, parity `0 0`, `AOD_DEPLOY_SHA`, kubectl/ingress/порты, `pre-apply-check.sh` | см. STATE.md | [x] |
| **1** | Namespace | `kubectl apply -f deploy/k8s/pilot/namespace.yaml` | `kubectl get ns acom-offer-desk-pilot` | [ ] |
| **2** | Metrics + kustomize dry-run | `kubectl top nodes`; `kubectl apply -k deploy/k8s/pilot --dry-run=client` | top OK; dry-run без ERROR | [ ] |
| **3** | SB checklist skeleton | Создать/обновить `docs/security-sb-checklist.md` (таблица R-*, без секретов) | файл в git, строки R-A1… | [ ] |
| **4** | A0 prep | Скопировать `build-images.sh.example` → `build-images.sh`; зафиксировать SHA в runbook/STATE | `echo $AOD_DEPLOY_SHA` | [ ] |
| **5** | A0 build/push | Сборка backend/web/notifications_worker @ SHA; push registry; digest в манифестах | `image@sha256:` в yaml | [ ] |
| **6** | B secrets/config | Secret/ConfigMap из examples (значения вне git); внутренние DNS URL | `kubectl get secret,cm -n pilot` | [ ] |
| **7** | C Postgres + TLS | StatefulSet Postgres, TLS Secret, NetworkPolicy data tier | Pod Ready; `sslmode=verify-full` | [ ] |
| **8** | C Flyway Job | Job `flyway-migrate` из `deploy/order_database/flyway/sql` | Job Complete; `user_auth_accounts` | [ ] |
| **9** | D infra | Deploy rabbitmq, minio, keycloak (import-realm) | Pods Ready; keycloak `/health/ready` | [ ] |
| **10** | D Keycloak Jobs | Jobs bootstrap → user-role-sync → init-deploy | Jobs Complete, логи без ERROR | [ ] |
| **11** | E app + F ingress | Rollout backend/web/worker; Ingress host пилота + `/etc/hosts` | readiness `/health`; HTTPS login | [ ] |
| **12** | G verify (8.1a) | Job `post-deploy-verify` + keycloak check; §8.1a чеклист | exit 0, без `[FAIL]` | [ ] |

**После шага 12 (функциональный пилот):** итерации §8.2 (NetworkPolicy, AMQPS, R-J2, пакет R-H4) — отдельный трек в STATE.md.

## Стоп-правило

Не переходить к шагу N+1 без явного «продолжай» / OK пользователя и зелёной проверки шага N.
