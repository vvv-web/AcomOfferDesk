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
| 1 | Namespace | **PASS** | `kubectl get ns acom-offer-desk-pilot` |
| 2 | Metrics + dry-run | **PASS** | `kubectl apply -k deploy/k8s/pilot --dry-run=client` OK; `kubectl top nodes` OK после фикса **node-ip** (см. `deploy/k8s/pilot/docs/K3S_HOST_NETWORKING.md`) |
| 3 | SB checklist | **PASS (verify)** | `docs/security-sb-checklist.md` exists |
| 4 | A0 prep | **PASS** | `deploy/k8s/pilot/scripts/build-images.sh` |
| 5 | A0 build | **PASS** | `acom-{backend,web,notifications-worker}:8ea43577e06e` imported to k3s |
| 6 | B secrets | **PARTIAL** | `backend/.env` **MISSING** → placeholders in `acom-app-secrets`; user must fill real secrets |
| 7 | C Postgres + TLS | **PASS (learn)** | `postgres-0` Running; `postgres-tls` Secret; **emptyDir** (not PVC); `sslmode=require` |
| 8 | C Flyway | **PASS** | Job `flyway-migrate` Complete → schema **v1.0.2** |
| 9 | D infra | **PASS** | rabbitmq, minio, keycloak Deployments **1/1 Running** |
| 10 | D Keycloak Jobs | **PARTIAL** | `keycloak-db-prepare` Complete; `keycloak-bootstrap` **Running** (re-created job 2026-05-20, pod `keycloak-bootstrap-wfxrk`, `enforce_atomic` — логи могут быть пустыми до вывода) |
| 11 | E app + F ingress | **PARTIAL** | backend/web/worker Running; `GET :8000/health` → `{"status":"ok"}`; Ingress backends in `describe` but NodePort **404** (ingress-nginx API/DNS issues) |
| 12 | G verify | **NOT RUN** | `post-deploy-verify` Job not applied (needs bootstrap + ingress path) |

## Применено в кластере

**Namespace:** `acom-offer-desk-pilot`

**Secrets:** `acom-app-secrets`, `postgres-tls`

**ConfigMaps:** `acom-backend-env`, `rabbitmq-config`, `flyway-sql-vtest`, `order-database-schema`, `keycloak-realm-import`, `keycloak-bootstrap-scripts`

**Workloads:** StatefulSet `postgres`; Deployments `rabbitmq`, `minio`, `keycloak`, `backend`, `web`, `notifications-worker`

**Services:** `postgres`, `rabbitmq`, `minio`, `keycloak`, `backend`, `web`

**Ingress:** `acom-pilot` (class `nginx`, host `aod-pilot.local`)

**Jobs Complete:** `postgres-init-schema`, `flyway-migrate`, `keycloak-db-prepare`

**Jobs Running:** `keycloak-bootstrap` (active 1/1, start `2026-05-20T11:42:38Z`)

## OpenLens (GUI k3s)

- Установлено: **`~/Applications/OpenLens.AppImage`** (OpenLens **6.5.2-366**, x86_64 AppImage, ~192 MB).
- Запуск: `~/Applications/OpenLens.AppImage` или `~/Desktop/OpenLens-launch.sh` (chmod +x).
- Инструкция: **`deploy/k8s/pilot/docs/OPENLENS.md`** (namespace `acom-offer-desk-pilot`, метрики, Logs, Jobs/Ingress).
- k3s сеть / metrics-server: **`deploy/k8s/pilot/docs/K3S_HOST_NETWORKING.md`** (node-ip `10.16.69.1`, не Tailscale `10.131.209.1`).
- kubeconfig: `~/.kube/config`, context **`default`**, API **`https://127.0.0.1:6443`**.
- `/etc/hosts`: `127.0.0.1 aod-pilot.local` — **уже есть**.

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

## Следующие действия

1. **OpenLens:** запустить AppImage → Add Cluster из `~/.kube/config` → namespace **`acom-offer-desk-pilot`** (см. `deploy/k8s/pilot/docs/OPENLENS.md`).
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
