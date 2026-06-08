# SB Step 4 — Postgres TLS + non-root (R-D1, R-D2, R-B2)

**Дата:** 2026-06-08  
**Namespace:** `acom-offer-desk-pilot`  
**Ветка:** `k8s-pilot-popos`  
**VPS prod:** не трогали

## Что задеплоено

| Ресурс | Изменение | R-* |
|--------|-----------|-----|
| `data/postgres-statefulset.yaml` | `ssl=on` + mount `postgres-tls` | R-D1 |
| `scripts/generate-postgres-tls.sh` | SAN: `DNS:postgres`, `DNS:postgres.<ns>.svc` | R-D1/R-D2 |
| `scripts/apply-pilot-secrets.sh` | `DATABASE_URL` `sslmode=verify-full` + `sslrootcert` | R-D2 |
| `workloads/backend.yaml` | mount `postgres-tls`, `PGSSLMODE=verify-full` | R-D2 |
| `workloads/rabbitmq.yaml` | `securityContext` uid **999**, `runAsNonRoot` | R-B2 |
| `workloads/notifications-worker.yaml` | `runAsNonRoot` uid **65532** | R-B2 |

**Оф. дока (PostgreSQL SSL):** https://www.postgresql.org/docs/current/libpq-ssl.html — `sslmode=verify-full` проверяет сертификат сервера и имя хоста.

## Верификация

```bash
./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step4.sh
```

| Тест | Результат |
|------|-----------|
| S4-T1 kustomize postgres ssl=on | **PASS** |
| S4-T2 rabbitmq runAsNonRoot in build | **PASS** |
| S4-T3 backend postgres-tls volume | **PASS** |
| S4-T4 secrets.example verify-full | **PASS** |
| S4-T5 `SHOW ssl` = on | **PASS** |
| S4-T6 secret/postgres-tls | **PASS** |
| S4-T7 DATABASE_URL verify-full | **PASS** |
| S4-T7b sslrootcert in URL | **PASS** |
| S4-T8 rabbitmq uid ≠ 0 | **PASS** |
| S4-T9 backend /health | **PASS** |
| S4-T10 asyncpg verify-full from backend | **PASS** |

**SUMMARY:** см. вывод скрипта после `git push` + Flux reconcile + rollout.

## Операции

```bash
./deploy/k8s/pilot/scripts/generate-postgres-tls.sh
./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh
./deploy/k8s/pilot/flux-phases/sync-hardlinks.sh
git push origin k8s-pilot-popos
flux reconcile source git flux-system -n flux-system
flux reconcile kustomization pilot-infra -n flux-system --with-source
flux reconcile kustomization pilot-apps -n flux-system --with-source
kubectl -n acom-offer-desk-pilot rollout restart statefulset/postgres deployment/backend deployment/rabbitmq
```

## Вердикт

**SB Step 4: PASS** — Postgres TLS включён; клиент backend на `verify-full` с CA; rabbitmq non-root.

**Следующий фокус:** Шаг 5 (R-B4 prod profile) — **не начинать без approve**.
