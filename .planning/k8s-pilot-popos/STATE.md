# STATE — K8s pilot pop-os

| Поле | Значение |
|------|----------|
| **Фаза** | Steps 1–11 applied; **12** pending; **10** bootstrap **Running** (re-applied 2026-05-20) |
| **OpenLens** | `~/Applications/OpenLens.AppImage` v6.5.2-366; doc `deploy/k8s/pilot/docs/OPENLENS.md` |
| **Roadmap** | v0.5 |
| **Кластер** | k3s `pop-os`, Kubernetes `v1.35.4+k3s1` |
| **Namespace** | `acom-offer-desk-pilot` |
| **AOD_DEPLOY_SHA** | `8ea43577e06e5fd8072d1e1438b9f102e0b3b8b9` |
| **Ветка** | `k8s-pilot-popos` (fork-only; база = `test` @ `d7f2af1`, parity `upstream/test`) |
| **VPS prod** | не трогали |
| **SB-пилот (§8.2)** | **Шаг 0–6 PASS** (2026-06-08); шаг 6 — secrets RBAC + placeholder guard; фокус **шаг 7** |
| **Flux @** | step 4 commit — `pilot-apps`/`pilot-infra` Ready; jobs-bootstrap/post зависят от migrate chain |

## Git policy: fork-only, branch k8s-pilot-popos, upstream read-only

| Remote | URL | Роль |
|--------|-----|------|
| **origin** | `git@github.com:vvv-web/AcomOfferDesk.git` | **единственный push** — форк Саши |
| **upstream** | `https://github.com/alexonderia/AcomOfferDesk.git` | **только fetch** — канон alexonderia, **не push** |

- Вся работа пилота K8s: `deploy/k8s/`, `.planning/k8s-pilot-popos/`, правки манифестов/скриптов пилота — **только** на ветке **`k8s-pilot-popos`** в форке.
- Синхронизация с каноном: `git fetch upstream` → при необходимости rebase/merge **`upstream/test`** в **`k8s-pilot-popos`** локально; в **alexonderia** ничего не пушить без явной просьбы пользователя.
- Публикация: `git push -u origin k8s-pilot-popos` (не `upstream`, не `alexonderia/main`).
- PR в upstream — только по явному запросу пользователя.

## Шаги 1–12 (вердикт)

| # | Шаг | Статус | Evidence (кратко) |
|---|-----|--------|-------------------|
| 0 | Preflight | **PASS** | `pre-apply-check.sh` exit 0; k3s Ready |
| 1 | Namespace + Flux pilot-* | **PASS** | `kubectl get ns acom-offer-desk-pilot`; `flux get kustomizations` — pilot-base/infra/apps/jobs-* Ready @ `4213530`; Job `post-deploy-verify` Complete |
| 2 | Metrics + dry-run | **PASS** | `kubectl apply -k deploy/k8s/pilot --dry-run=client` OK; `kubectl top nodes` OK после фикса **node-ip** (см. `deploy/k8s/pilot/docs/K3S_HOST_NETWORKING.md`) |
| 3 | SB checklist | **PASS (verify)** | `docs/security-sb-checklist.md` exists |
| 4 | A0 prep | **PASS** | `deploy/k8s/pilot/scripts/build-images.sh` |
| 5 | A0 build | **PASS** | `acom-{backend,web,notifications-worker}:8ea43577e06e` imported to k3s |
| 6 | B secrets | **PARTIAL** | `backend/.env` **MISSING** → placeholders in `acom-app-secrets`; user must fill real secrets |
| 7 | C Postgres + TLS | **PASS (learn)** | `postgres-0` Running; `postgres-tls` Secret; **emptyDir** (not PVC); `sslmode=require` |
| 8 | C Flyway | **PASS** | Job `flyway-migrate` Complete → schema **v1.0.2** |
| 9 | D infra | **PASS** | rabbitmq, minio, keycloak Deployments **1/1 Running** |
| 10 | D Keycloak Jobs | **PASS** | `keycloak-bootstrap` Complete 2026-06-08 (~7m40s); `enforce_atomic` + `sync_composite_role` в `bootstrap.sh` |
| 11 | E app + F ingress | **PARTIAL** | backend/web/worker Running; `GET :8000/health` → `{"status":"ok"}`; Ingress backends in `describe` but NodePort **404** (ingress-nginx API/DNS issues) |
| 12 | G verify | **PASS** | Job `post-deploy-verify` Complete; `POST_DEPLOY_VERIFY_K8S: all checks passed` |

## Применено в кластере

**Namespace:** `acom-offer-desk-pilot`

**Secrets:** `acom-app-secrets`, `postgres-tls`

**ConfigMaps:** `acom-backend-env`, `rabbitmq-config`, `flyway-sql-vtest`, `order-database-schema`, `keycloak-realm-import`, `keycloak-bootstrap-scripts`

**Workloads:** StatefulSet `postgres`; Deployments `rabbitmq`, `minio`, `keycloak`, `backend`, `web`, `notifications-worker`

**Services:** `postgres`, `rabbitmq`, `minio`, `keycloak`, `backend`, `web`

**Ingress:** `acom-pilot` (class `nginx`, host `pilot.acom-offer-desk.ru`, TLS `acom-pilot-tls`, ports 80+443)

**Jobs Complete:** `postgres-init-schema`, `flyway-migrate`, `keycloak-db-prepare`

**Jobs Running:** `keycloak-bootstrap` (active 1/1, start `2026-05-20T11:42:38Z`)

## OpenLens (GUI k3s)

- Установлено: **`~/Applications/OpenLens.AppImage`** (OpenLens **6.5.2-366**, x86_64 AppImage, ~192 MB).
- Запуск: `~/Applications/OpenLens.AppImage` или `~/Desktop/OpenLens-launch.sh` (chmod +x).
- Инструкция: **`deploy/k8s/pilot/docs/OPENLENS.md`** (namespace `acom-offer-desk-pilot`, метрики, Logs, Jobs/Ingress).
- k3s сеть / metrics-server: **`deploy/k8s/pilot/docs/K3S_HOST_NETWORKING.md`** (node-ip `10.16.69.1`, не Tailscale `10.131.209.1`).
- kubeconfig: `~/.kube/config`, context **`default`**, API **`https://127.0.0.1:6443`**.
- `/etc/hosts` для браузера: `127.0.0.1 pilot.acom-offer-desk.ru` (или LB `10.16.67.241`); legacy `aod-pilot.local` больше не в Ingress.

## k3s host networking (2026-05-20, pop-os)

| До | После |
|----|-------|
| `node-ip: 10.131.209.1` (Tailscale, недоступен) | `node-ip: 10.16.69.1` (LAN Wi‑Fi) |
| API endpoint → timeout из pod | `kubernetes` Endpoints: `10.16.69.1:6443` (+ legacy) |
| metrics-server CrashLoop, CoreDNS 0/1 | metrics-server **1/1**, CoreDNS **1/1**, `kubectl top` OK |

Хост: `/etc/rancher/k3s/config.yaml` + `sudo systemctl restart k3s` + `kubectl rollout restart deployment/coredns -n kube-system`.

Документация в репо: **`deploy/k8s/pilot/docs/K3S_HOST_NETWORKING.md`**.

## Исправления в репо (сессия K8s pilot)

- `backend/Dockerfile`: `COPY shared`, `COPY scripts`, `chmod` bootstrap/scripts
- `DATABASE_URL`: `postgresql+asyncpg://` in apply/patch scripts
- `notifications-worker`: `python -m app.main`
- `keycloak-bootstrap.job.yaml`: image `quay.io/keycloak/keycloak:26.5` + CM mount (не backend — нет `kcadm`)
- `keycloak` readiness: `tcpSocket` :8080 (HTTP `/health/ready` → 404 на distro)
- `ingress`: `ingressClassName: nginx`
- Pilot manifests/scripts under `deploy/k8s/pilot/` (postgres emptyDir, IP patch, schema/flyway CMs)

## Blockers (нужен пользователь)

1. **`backend/.env` (chmod 600)** — реальные `JWT_SECRET`, Keycloak, SMTP, email, MinIO, RabbitMQ; затем `./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh` + **`patch-secrets-service-ips.sh`**
2. **Ingress 404 через NodePort** — ingress-nginx может не синхронизировать routes; smoke через `kubectl port-forward` или ClusterIP
3. **Keycloak bootstrap** — `enforce_atomic` / VERIFY_FAIL permission roles; см. Logs job; дождаться **Complete** перед `keycloak-user-role-sync` и `post-deploy-verify`
4. **CoreDNS / Service DNS** — после фикса node-ip DNS из pod работает; при `backend/.env` всё равно запускать **`patch-secrets-service-ips.sh`** после `apply-pilot-secrets` (если имена сервисов не резолвятся)

## Smoke (работает сейчас)

```bash
# Backend health (ClusterIP)
BE_IP=$(kubectl -n acom-offer-desk-pilot get svc backend -o jsonpath='{.spec.clusterIP}')
kubectl run curl-be --rm -i --restart=Never -n acom-offer-desk-pilot \
  --image=curlimages/curl:8.5.0 -- curl -sf "http://${BE_IP}:8000/health"

# Web direct
WEB_IP=$(kubectl -n acom-offer-desk-pilot get svc web -o jsonpath='{.spec.clusterIP}')
curl -sf "http://${WEB_IP}:80/" -o /dev/null -w '%{http_code}\n'
```

## SB Шаг 1 — тест 2026-06-08 (канвас)

| Тест | Результат | Evidence |
|------|-----------|----------|
| T1 образы в k3s | **PASS** | 3× `acom-*:8ea43577e06e` (`k3s ctr images import`) |
| T2 backend | **PASS** | `deploy/backend` 1/1 |
| T3 web | **PASS** | `deploy/web` 1/1 |
| T4 worker | **PASS** | `deploy/notifications-worker` 1/1 |
| T5 keycloak | **PASS** | `deploy/keycloak` 1/1 (schema `keycloak` re-created job) |
| T6 /health | **PASS** | `curl localhost:8000/health` → `{"status":"ok"}` |
| T7a Tailscale×10.43 | **PASS** | `ip route show table 52` → `throw 10.43.0.0/16`; timer `install-k3s-tailscale-exclude-service-cidr.sh` |
| T7 Flux chain | **PASS** | все `pilot-*` Ready @ `26b64d1fc08ffa7e12bc0a9a0df70a7e48652132`; см. `FLUX-FIX-EVIDENCE.md` |
| T8 ErrImageNeverPull | **PASS** | после import; stale pods удалены |

**Сделано:** Tailscale exclude Service CIDR (`K3S_HOST_NETWORKING.md` § Tailscale); `apply-pilot-secrets.sh`, import образов, `keycloak-db-prepare` re-run, rollout restart app deploys.

**T7 (2026-06-08):** Flux controllers без hostNetwork (throw route достаточен); reconcile git → infra → migrate → bootstrap → post → apps — все Ready.

**Вердикт SB шаг 1:** **PASS** (2026-06-08) — все pilot-* Kustomization Ready=True @ `4213530`; k3s `node-ip` выровнен на `10.16.67.241`; NRestarts=0.

## SB Шаг 2 — тест 2026-06-08 (Edge TLS + hostname)

| Тест | Результат | Evidence |
|------|-----------|----------|
| S2-T1 kustomize tls | **PASS** | `spec.tls.secretName: acom-pilot-tls` |
| S2-T2 TLS secret | **PASS** | `generate-pilot-ingress-tls.sh` → `secret/acom-pilot-tls` |
| S2-T3 Ingress tls host | **PASS** | `kubectl get ingress` → `pilot.acom-offer-desk.ru`, ports 80,443 |
| S2-T4 KC_HOSTNAME https | **PASS** | `https://pilot.acom-offer-desk.ru/iam` |
| S2-T5 HTTPS /health | **PASS** | `curl -k -H Host:… https://10.16.67.241/health` → 200 |
| S2-T6 OIDC redirect FQDN | **PASS** | `Location: https://pilot.acom-offer-desk.ru/iam/realms/...` |

**Сделано:** `networking/ingress.yaml` TLS + ssl-redirect; `apply-pilot-secrets.sh` https + `KC_HOSTNAME_STRICT*`; `verify-k8s-pilot-sb-step2.sh` **7/7 PASS**.

**Keycloak rollout (2026-06-08):** CrashLoop на новом pod — не SA/RBAC, а **нет схемы `keycloak`** в Postgres (`KC_DB_SCHEMA`) после ephemeral `emptyDir` у postgres; старый pod на RS `7b8484b68c` (SA `default`) держал rollout. **Фикс:** initContainer `keycloak-db-schema` в `workloads/keycloak.yaml` + `keycloak-db-prepare.job.yaml` на `KC_DB_*`; live **1/1** `acom-pilot-data` (`keycloak-555b47b579-*`); `verify-k8s-pilot-sb-step6.sh` **11/11 PASS**.

**Операции 2026-06-08 (verifier gaps):** удалён stale `ingress-nginx-controller` pod (Error); `kubectl rollout restart deployment/keycloak` после CM `KC_HOSTNAME=https://pilot.acom-offer-desk.ru/iam`; `verify-k8s-pilot-sb-step2.sh` → **7/7 PASS** (k3s API stable).

**Вердикт SB шаг 2:** **PASS** — R-A2/R-G1 live (S2-T1..T6); `verify-k8s-pilot-sb-step2.sh` **7/7 PASS**; Flux chain @ `26b64d1` Ready.

## SB Шаг 3 — тест 2026-06-08 (NetworkPolicy)

| Тест | Результат | Evidence |
|------|-----------|----------|
| S3-T1 kustomize NP | **PASS** | `networking/networkpolicy.yaml` in `kustomization.yaml` |
| S3-T2 live NP count | **PASS** | `kubectl get networkpolicy` → 2 |
| S3-T3 deny-data-egress | **PASS** | `policyTypes: [Egress]` |
| S3-T4 data tier labels | **PASS** | postgres, rabbitmq, minio `acom.security/tier=data` |
| S3-T5 app tier labels | **PASS** | backend, web, worker, keycloak `tier=app` |
| S3-T6 egress deny | **PASS** | minio pod cannot reach 1.1.1.1 |
| S3-T7 app→data health | **PASS** | backend `/health` 200 after NP |

**Сделано:** `networkpolicy.yaml` (deny-data-egress + data-tier-ingress-from-app); tier labels on workloads; Flux `pilot-apps` @ `912bcba`; `verify-k8s-pilot-sb-step3.sh` **14/14 PASS**.

**Вердикт SB шаг 3:** **PASS** — R-A3/R-D3; evidence `SB-STEP3-EVIDENCE.md`.

## SB Шаг 4 — тест 2026-06-08 (Postgres TLS + non-root)

| Тест | Результат | Evidence |
|------|-----------|----------|
| S4-T1 kustomize ssl=on | **PASS** | `data/postgres-statefulset.yaml` |
| S4-T2 rabbitmq runAsNonRoot | **PASS** | uid **999** |
| S4-T3 backend postgres-tls mount | **PASS** | `PGSSLMODE=verify-full` |
| S4-T5 postgres SHOW ssl | **PASS** | `on` |
| S4-T7 DATABASE_URL verify-full | **PASS** | `apply-pilot-secrets.sh` |
| S4-T8 rabbitmq non-root | **PASS** | `id -u` → 999 |
| S4-T9 backend /health | **PASS** | TLS client OK |
| S4-T10 asyncpg verify-full | **PASS** | from backend pod |

**Сделано:** `generate-postgres-tls.sh` SAN; `verify-k8s-pilot-sb-step4.sh`; rabbitmq `securityContext`; backend CA mount.

**Вердикт SB шаг 4:** **PASS** — R-D1/R-D2/R-B2; evidence `SB-STEP4-EVIDENCE.md`.

## SB Шаг 5 (2026-06-08) — R-B4 prod profile

| Тест | Результат | Evidence |
|------|-----------|----------|
| S5-T1 readiness /health in kustomize | **PASS** | `workloads/backend.yaml` |
| S5-T2 APP_ENV=production | **PASS** | deployment env + `apply-pilot-secrets.sh` |
| S5-T3 ingress no /docs route | **PASS** | `networking/ingress.yaml` |
| S5-T6 in-cluster /docs → 404 | **PASS** | backend `main.py` OpenAPI off |
| S5-T7 ingress /health → 200 | **PASS** | |
| unit tests `test_prod_openapi_surface.py` | **PASS** | 4/4 |

**Сделано:** `settings.openapi_enabled`; FastAPI `docs_url=None` in production; `verify-k8s-pilot-sb-step5.sh`.

**Вердикт SB шаг 5:** **PASS** — R-B4; `verify-k8s-pilot-sb-step5.sh` **10/10**; Flux @ `68b61cb`; evidence `SB-STEP5-EVIDENCE.md`.

## SB Шаг 6 (2026-06-08) — R-C2 secrets RBAC

| Тест | Результат | Evidence |
|------|-----------|----------|
| S6-T1 RBAC in kustomize | **PASS** | `rbac/secrets-rbac.yaml` |
| S6-T3 runtime SA on workloads | **PASS** | `serviceAccountName` backend/web/worker/data |
| S6-T10 live backend SA | **PASS** | `kubectl apply -k` + rollout restart (был пустой SA) |
| S6-T7 runtime no get secrets | **PASS** | `kubectl auth can-i` |
| S6-T8 operator get named secret | **PASS** | resourceNames Role |
| S6-T11 secret managed-by label | **PASS** | `apply-pilot-secrets.sh` |

**Сделано:** runbook `RUNBOOK-PILOT-SECRETS-RBAC.md`; placeholder guard в apply-скрипте; `verify-k8s-pilot-sb-step6.sh`.

**Вердикт SB шаг 6:** **PASS** — R-C2; `verify-k8s-pilot-sb-step6.sh` **11/11**; evidence `SB-STEP6-EVIDENCE.md`.

## Следующие действия

1. **SB Шаг 7:** CI инварианты (R-C3) — `check_k8s_pilot_security.py` (**не начинать без approve**).
2. **`/etc/hosts`:** `127.0.0.1 pilot.acom-offer-desk.ru` для браузера.
3. ~~**Flux chain**~~ **DONE** (2026-06-08) — см. `FLUX-FIX-EVIDENCE.md`.
2. **OpenLens:** запустить AppImage → Add Cluster из `~/.kube/config` → namespace **`acom-offer-desk-pilot`** (см. `deploy/k8s/pilot/docs/OPENLENS.md`).
2. Дождаться `kubectl -n acom-offer-desk-pilot wait --for=condition=complete job/keycloak-bootstrap --timeout=3600s` (следить в OpenLens: Jobs → `keycloak-bootstrap`).
3. После Complete: `kubectl apply -f deploy/k8s/pilot/jobs/keycloak-user-role-sync.job.yaml`
4. Заполнить **`backend/.env`** (chmod 600) → `./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh` + **`patch-secrets-service-ips.sh`** (значения не печатать).
5. `kubectl apply -f deploy/k8s/pilot/jobs/post-deploy-verify.job.yaml` (шаг 12)
6. Починить CoreDNS / ingress-nginx или продолжать smoke через port-forward
7. Опционально: пересобрать образы — `./deploy/k8s/pilot/scripts/build-images.sh`

## Жёсткий стоп (если bootstrap Failed)

```bash
kubectl -n acom-offer-desk-pilot logs job/keycloak-bootstrap --tail=80
kubectl -n acom-offer-desk-pilot get pods -l job-name=keycloak-bootstrap
```

## SB steps 7–12 (2026-06-08)

**PASS** on pop-os pilot — AMQPS, MinIO TLS, CI gate, R-H4 package, R-J2 upload plan. VPS prod untouched.
