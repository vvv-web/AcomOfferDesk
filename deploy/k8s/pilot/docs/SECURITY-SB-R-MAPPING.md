# Маппинг R-* → манифесты K8s-пилота (gap-статус)

**Канон требований:** [security-board-requirements](https://github.com/vvv-web/security-board-requirements) v1.1  
**Чеклист статусов:** [`docs/security-sb-checklist.md`](../../../../docs/security-sb-checklist.md)  
**Дорожная карта:** [`docs/operations/kubernetes-migration-roadmap.md`](../../../../docs/operations/kubernetes-migration-roadmap.md) §4.2, §8.2  
**Namespace:** `acom-offer-desk-pilot` · **Ветка:** `k8s-pilot-popos` · **Flux revision:** step 6 (проверять `flux get kustomizations`)  
**SB Шаг 1:** **PARTIAL** (2026-06-08) — см. [STATE.md](../../../../.planning/k8s-pilot-popos/STATE.md) § «SB Шаг 1»

**Легенда:** ✅ закрыто · ⚠️ частично · ❌ gap · 📋 следующий шаг (см. [SB-STEPS.md](../../../../.planning/k8s-pilot-popos/SB-STEPS.md))

| ID | Файл(ы) в `deploy/k8s/pilot/` | Статус | Gap / что сделать |
|----|------------------------------|--------|-------------------|
| **R-A1** | `workloads/*.yaml`, `data/postgres-statefulset.yaml`, `flux-phases/*/resources/**` | ⚠️ | В манифестах **ClusterIP**; live: `kubectl get svc` — без NodePort для app. Проверить `ss -tlnp` на node. |
| **R-A2** | `networking/ingress.yaml`, `scripts/generate-pilot-ingress-tls.sh`, Secret `acom-pilot-tls` | ✅ | `spec.tls` + nginx ssl-redirect; learn self-signed. **Шаг 2 PASS** 2026-06-08 |
| **R-A3** | `networking/networkpolicy.yaml` | ✅ | `deny-data-egress` + `data-tier-ingress-from-app`; labels tier app/data. **Шаг 3 PASS** 2026-06-08 |
| **R-B1** | `workloads/keycloak.yaml`, `flux-phases/infra/resources/workloads/keycloak.yaml` | ⚠️ | `args: ["start", "--import-realm"]` ✅; deploy **1/1 Running** (2026-06-08, T5 PASS). Job `keycloak-bootstrap` — **PARTIAL** (**Шаг 1** / **Шаг 10**) |
| **R-B2** | `workloads/{backend,keycloak,minio,web,notifications-worker,rabbitmq}.yaml` | ✅ | backend/keycloak/minio/worker: **65532**; rabbitmq: **999** + `runAsNonRoot`. **Шаг 4 PASS** 2026-06-08 |
| **R-B3** | `workloads/*.yaml`, `scripts/build-images.sh` | ⚠️ | `acom-{backend,web,notifications-worker}:8ea43577e06e` **imported** (`k3s ctr images import`, T1/T8 PASS); теги не `@sha256`, registry gap — **Шаг 1 PARTIAL** |
| **R-B4** | `workloads/backend.yaml`, `backend/app/main.py` | ✅ | readiness `/health`; `APP_ENV=production`; `/docs`/`/openapi.json` → 404. **Шаг 5 PASS** 2026-06-08 |
| **R-C1** | `config/secrets.example.yaml`, Secret `acom-app-secrets` | ⚠️ | В git только example; live Secret есть — убрать placeholders. **Шаг 1** |
| **R-C2** | `rbac/secrets-rbac.yaml`, `docs/RUNBOOK-PILOT-SECRETS-RBAC.md` | ✅ | runtime SA без `get secrets`; operator SA + resourceNames. **Шаг 6 PASS** 2026-06-08 |
| **R-C3** | *(нет)* `.github/scripts/check_k8s_pilot_security.py` | ❌ | Нет CI на `kustomize build` (как `check_vps_compose_security.py`). **Шаг 7** |
| **R-C4** | `jobs/keycloak-bootstrap.job.yaml`, `flux-phases/jobs-bootstrap/...` | ⚠️ | Job из Secret; realm-import без паролей — проверить CM/импорт. |
| **R-D1** | `data/postgres-statefulset.yaml`, `scripts/generate-postgres-tls.sh`, Secret `postgres-tls` | ✅ | live `SHOW ssl=on`; cert SAN `DNS:postgres`. **Шаг 4 PASS** 2026-06-08 |
| **R-D2** | `config/secrets.example.yaml`, `apply-pilot-secrets.sh`, backend mount | ✅ | `DATABASE_URL` sslmode=verify-full + sslrootcert; backend PGSSL*. **Шаг 4 PASS** 2026-06-08 |
| **R-D3** | `data/postgres-statefulset.yaml` + **R-A3** NetworkPolicy | ✅ | data-tier NP live; ingress app-only. **Шаг 3 PASS** 2026-06-08 |
| **R-E1** | `config/secrets.example.yaml`, `workloads/rabbitmq.yaml` | ⚠️ | Учётки из Secret; guest не проверен скриптом. |
| **R-E2** | `workloads/rabbitmq.yaml`, `config/rabbitmq-configmap.yaml` | ❌ | **Plain AMQP 5672** в Service и containerPort; нет `listeners.tcp=none` / TLS. **Шаг 8** |
| **R-E3** | backend/worker env `CELERY_BROKER_URL` | ❌ | Нет `amqps://` + verify в пилоте. **Шаг 8** |
| **R-F1** | `workloads/minio.yaml` | ⚠️ | `runAsUser: 65532` ✅ live; TLS MinIO — не в manifest. **Шаг 9** |
| **R-F2** | backend storage (образ backend) | ❌ | Проверка `cert_check` в коде + env пилота. **Шаг 9** |
| **R-F3** | `workloads/minio.yaml` | ✅ | `kubectl exec … minio -- id -u` → **65532** |
| **R-F4** | `docs/security-sb-checklist.md` §R-J2 | ⚠️ | Бизнес-файлы в MinIO — только с планом R-J2. |
| **R-G1** | `acom-backend-env`, `apply-pilot-secrets.sh`, Ingress host | ✅ | FQDN `pilot.acom-offer-desk.ru`, https URLs, `KC_HOSTNAME_STRICT*`. **Шаг 2 PASS** 2026-06-08 |
| **R-G2** | realm bootstrap (Job) | ❌ | Live 2FA не проверено. **Шаг 10** |
| **R-G3** | backend env в secrets.example | ❌ | По требованию ИБ. |
| **R-H1** | Flux на пилоте, `README.md` | ✅ | Пилот — GitOps с ручным reconcile; VPS prod autodeploy отдельно. |
| **R-H2** | annotations `acom.deploy/sha`, `scripts/pre-apply-check.sh` | ⚠️ | `acom.deploy/sha` annotation ✅; digest образов / registry — gap. **Шаг 1 PARTIAL** |
| **R-H3** | `deploy/k8s/pilot/` vs `overlays/` | ⚠️ | Pilot отделён; prod overlay не заполнен. |
| **R-H4** | `docs/security-sb-checklist.md`, этот файл, `kustomize build` | ❌ | Пакет для ИБ не собран. **Шаг 11** |
| **R-H5** | `backend/requirements.txt` в образе A0 | ❌ | Lock + пересборка при bump. **Шаг 1** |
| **R-J1** | код backend (UploadFile) | — | **Не N/A** — upload есть в продукте. |
| **R-J2** | `docs/security/` *(создать `security-upload-k8s-pilot.md`)* | ❌ | План ИБ для upload до §8.2. **Шаг 12** |

## SB Шаг 1 — верификация (2026-06-08)

Синхрон с [`docs/security-sb-checklist.md`](../../../../docs/security-sb-checklist.md) и [STATE.md](../../../../.planning/k8s-pilot-popos/STATE.md).

| Тест | Результат | Evidence |
|------|-----------|----------|
| T1 образы в k3s | **PASS** | 3× `acom-*:8ea43577e06e` (`ctr images import`) → **R-B3** |
| T2–T4 app deploys | **PASS** | backend, web, notifications-worker **1/1** |
| T5 keycloak | **PASS** | `deploy/keycloak` **1/1 Running** → **R-B1** (не CrashLoop) |
| T6 `/health` | **PASS** | `{"status":"ok"}` |
| T7a Tailscale×Service CIDR | **PASS** | `ip route show table 52` → `throw 10.43.0.0/16` ([`K3S_HOST_NETWORKING.md`](./K3S_HOST_NETWORKING.md) § Tailscale) |
| T7 Flux chain | **FAIL** | `pilot-base` Ready; `pilot-infra` Unknown; `pilot-apps`/jobs не Ready — **Шаг 1 PARTIAL** |
| T8 ErrImageNeverPull | **PASS** | после import; stale pods удалены → **R-B3** |

**Вердикт:** **PARTIAL** — app + Keycloak + /health + Tailscale OK; ждём все `pilot-*` Kustomization Ready + digest/registry для PASS.

## K8s-расширения (из `OUT-OF-SCOPE.md` каталога СБ)

| Тема | Файл / действие | Статус |
|------|-----------------|--------|
| Pod Security Standards | namespace labels / PSS restricted | ❌ |
| SealedSecrets / ESO | вместо ручного `kubectl create secret` | ❌ |
| Ingress TLS | `generate-pilot-ingress-tls.sh` → `acom-pilot-tls` | ✅ learn self-signed |
| Verify script | `scripts/verify-k8s-pilot-sb-step{2,3,4,5,6}.sh` | ✅ |

## Быстрые команды проверки

```bash
export NS=acom-offer-desk-pilot
kubectl get svc,ingress,networkpolicy -n "$NS"
kubectl get pods -n "$NS"
kubectl -n "$NS" exec deploy/minio -- id -u
flux get kustomizations -n flux-system | rg pilot
```
