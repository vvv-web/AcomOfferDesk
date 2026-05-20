# AcomOfferDesk — дорожная карта: развёртывание в Kubernetes и миграция

**Статус:** v0.5 — каталог `deploy/k8s/` и чеклист СБ в репо; apply пилота — после A0 + копирования `.example`  
**Основание:** текущий runtime на Docker Compose ([runtime-architecture](../product/runtime-architecture.md), [environments](./environments.md))  
**Требования СБ (канон):** [vvv-web/security-board-requirements](https://github.com/vvv-web/security-board-requirements) — `docs/REQUIREMENTS.md`, `docs/CHECKLIST.md`, `docs/VERIFICATION.md` (локально: `~/Desktop/security-board-requirements/`)  
**Вне scope:** Camunda, общий monitoring-стек, OpenLens — отдельные проекты

**Цель документа:** пошагово развернуть AcomOfferDesk в Kubernetes и мигрировать с Docker/VPS **так**, чтобы пилот и последующий prod-контур **полностью соответствовали** универсальному каталогу требований СБ (идентификаторы **R-*** и применимые **O-***), с отдельным чеклистом статуса в репозитории приложения.

**Жёсткое правило:** тестовый подъём на **pop-os** (отдельная БД, без prod VPS) **не освобождает** от требований СБ. «Учебный» контур = тот же профиль hardening, что и будущий prod в K8s. Послабления (**`:latest`**, `/docs` в prod, plaintext AMQP, TLS off, секреты в git) **запрещены** — только **✅** по [CHECKLIST.md](https://github.com/vvv-web/security-board-requirements/blob/main/docs/CHECKLIST.md) или **задокументированное отклонение** с согласованием ИБ (таблица «Известные отклонения»).

---

## 1. Что есть сейчас (кратко по проекту)

### 1.1. Сервисы в `docker-compose.yml`

| Сервис | Образ / сборка | Состояние | Healthcheck (compose) |
|--------|----------------|-----------|------------------------|
| `keycloak` | `quay.io/keycloak/keycloak:26.5` | PVC `keycloak_data` | management `/health/ready` |
| `backend` | build `./backend` | stateless | compose: `GET /docs` — **K8s пилот/prod: readiness `GET /health`** (**R-B4**) |
| `web` | build `./web` | stateless | nginx + `index.html` |
| `gateway` | `nginx:1.27-alpine` | маршрутизация | depends_on healthy |
| `rabbitmq` | `rabbitmq:3-management` | in-compose | `rabbitmq-diagnostics ping` |
| `minio` | `minio/minio` | PVC `minio_data` | `/minio/health/ready` |
| `notifications_worker` | build | stateless worker | — |

**Публичный вход:** только `gateway` → `127.0.0.1:8080` (на VPS внешний HTTPS на edge nginx — см. [environments](./environments.md)).

**Маршруты gateway** (`backend/nginx.conf`):

- `/` → `web`
- `/api/*` → `backend`
- `/iam/*` → `keycloak`

### 1.2. Внешние зависимости (критично для K8s)

| Зависимость | Где сейчас | Документ |
|-------------|------------|----------|
| **PostgreSQL** (`order_database`) | Отдельный compose на VPS, хост `order-database-postgres`, сеть **`project_net`** | [order-database-vps.md](./order-database-vps.md) |
| **Flyway** | При деплое: копия `deploy/order_database/flyway/sql` → `/opt/order_database` → migrate | `.github/workflows/deploy.yml` |
| **Init Keycloak** | `docker-compose.init.yml`: bootstrap, role sync | `infra/keycloak/bootstrap.sh` |

Backend читает `DATABASE_URL`, Keycloak — `KEYCLOAK_INTERNAL_BASE_URL` (по умолчанию `http://keycloak:8080/iam`). В кластере имена сервисов заменяются на DNS Kubernetes (`Service`).

### 1.3. Деплой сегодня (порядок = эталон для K8s Jobs)

Ветка **`test`** → GitHub Actions SSH на VPS (`.github/workflows/deploy.yml`):

1. `git reset --hard upstream/test` (+ `AOD_DEPLOY_SHA` = HEAD)
2. **order_database:** sync `deploy/order_database/flyway/sql` → flyway migrate → SQL checks (`user_auth_accounts`, …)
3. **compose up (последовательно):** `rabbitmq` → `minio` → `keycloak` → `backend` + `notifications_worker` → `web` → `gateway` reload/recreate
4. **`keycloak-init-deploy.sh`** (skip bootstrap если model OK + SHA bootstrap не менялся)
5. **`post-deploy-verify.sh`** (из running backend, не `compose run`)

Сеть **`project_net`** — общая для app + Postgres на VPS (для **фазы 1 K8s не используется** — см. §5.B4, этап C).

**DAG Jobs в K8s (пилот)** — зеркало deploy.yml + Keycloak chain:

```text
[A0] build/push образов (backend, web, notifications_worker) @ AOD_DEPLOY_SHA + digest в манифестах
        |
[C4] Job flyway-migrate  (до любого backend)
        |
[C1-C3] Postgres StatefulSet Ready + TLS
        |
[D2,D3] Deploy rabbitmq, minio Ready
        |
[D1]  Deploy keycloak (+ import-realm в entrypoint `start --import-realm`, см. D4)
        |
[D5]  Job keycloak-db-prepare (если нужен отдельный шаг до import)
        |
[D5]  Job keycloak-bootstrap → Job keycloak-user-role-sync
        |
[E*]  Rollout backend, web, notifications_worker
        |
[D5b] Job keycloak-init-deploy (skip logic как VPS)
        |
[G4]  Job post-deploy-verify (образ backend@test-SHA, POST_DEPLOY_BASE_URL=Ingress)
        |
[G4b] Keycloak permission check (тот же Job или follow-up)
```

Канон имён и `.example` манифестов: **`deploy/k8s/pilot/jobs/`** (README с таблицей зависимостей).

### 1.4. Источник кода для K8s (обязательно ветка `test`)

**Пилот и prod в Kubernetes собираются только из актуальной ветки `test`** — того же снимка, что уходит на VPS. Не использовать устаревший локальный `dev` или старый образ без пересборки.

| Параметр | Значение |
|----------|----------|
| Канон upstream | **`alexonderia/AcomOfferDesk`** → ветка **`test`** (на форке: `upstream/test` после `git fetch upstream`) |
| Зафиксировать перед build | **`git rev-parse upstream/test`** → записать SHA в чеклист / `R-H2` / labels манифестов |
| Сверка | `git rev-list --left-right --count HEAD...upstream/test` → ожидаемо **`0 0`** перед сборкой образов |

**Что изменилось на `test` (май 2026) и должно попасть в K8s-контур:**

| Область | Файлы / поведение | Эквивалент в K8s |
|---------|-------------------|------------------|
| Keycloak bootstrap | `infra/keycloak/bootstrap.sh` (идемпотентность, permission model, ускорение) | ConfigMap/образ с **той же** версией скрипта; Job `keycloak_bootstrap` |
| Init без лишнего bootstrap | `scripts/keycloak-init-deploy.sh` — skip если model OK + SHA bootstrap не менялся | Job/CronJob или pre-upgrade hook с той же логикой |
| Permission model check | `scripts/run-keycloak-check-backend.sh`, `backend/app/scripts/check_keycloak_permission_model.py` | Job post-deploy из **образа backend** того же SHA |
| Role manifest / sync | `keycloak_role_manifest.py`, `sync_keycloak_user_app_roles.py`, `keycloak_app_roles.py` | Job `keycloak_user_role_sync` после bootstrap |
| Post-deploy gate | `scripts/post-deploy-verify.sh`, `smoke_services.py` (MinIO internal, таймауты RabbitMQ) | Job `post-deploy-verify` с `POST_DEPLOY_BASE_URL` Ingress пилота |
| Deploy CI parity | `.github/workflows/deploy.yml` — staged compose recreate, `keycloak-init-deploy` перед verify | порядок Jobs: migrate → workloads → keycloak-init → post-deploy-verify |
| Flyway | `deploy/order_database/flyway/sql` с **той же** ветки | Flyway Job **до** backend |
| Backend/API | `users.py`, `offers.py`, `auth_context`, contractor UI | образ `backend` из SHA `test` |
| Compose runtime | `docker-compose.yml`, `docker-compose.init.yml` | манифесты, не старый compose на VPS |

**Запрещено для K8s-пилота:**

- собирать образы с ветки **`dev`** или локального коммита «позади» `upstream/test`;
- монтировать старый `bootstrap.sh` с диска VPS;
- считать пилот валидным без **`post-deploy-verify`** (и при необходимости keycloak check) из **свежего** backend-образа.

**Перед `kubectl apply` (чеклист):**

```bash
cd ~/Desktop/acome-offer-desk/AcomOfferDesk
git fetch upstream test
git checkout test && git reset --hard upstream/test   # или merge ff-only с upstream/test
export AOD_DEPLOY_SHA="$(git rev-parse HEAD)"
echo "K8s build source: test @ $AOD_DEPLOY_SHA"
# build/push backend, web, notifications_worker с этим SHA → digest в манифестах (R-B3)
```

---

## 2. Целевая картина в Kubernetes (логика без привязки к YAML)

```text
Internet / корп. reverse proxy
        |
   Ingress (nginx)  — один host, TLS на edge
        |
   Service "gateway"  (или Ingress rules напрямую на web/backend/keycloak)
   |-- /     -> web
   |-- /api  -> backend
   |-- /iam  -> keycloak

В namespace (например acom-offer-desk-pilot):
  Deployment: web, backend, notifications_worker
  Deployment/StatefulSet: keycloak (+ PVC)
  Deployment: rabbitmq, minio (+ PVC)
  Job/CronJob: keycloak bootstrap (аналог compose.init)

В namespace (data tier):
  PostgreSQL (order_database) — отдельный тестовый инстанс пилота (StatefulSet + PVC + TLS)
```

**Принцип миграции:** сначала поднять **полный** стек в K8s на **изолированных** данных (pop-os learn) **с полным соблюдением R-***; prod VPS не трогать; перенос prod-данных и cutover — только после зелёного пилота + чеклиста СБ.

---

## 3. Официальные источники (норматив)

Использовать при каждом шаге — версию **Kubernetes/k3s** зафиксировать в начале работ (skew: [Version skew policy](https://kubernetes.io/releases/version-skew-policy/)).

| Тема | Официальная документация |
|------|---------------------------|
| Обзор workload | [Workloads](https://kubernetes.io/docs/concepts/workloads/) |
| Deployment (backend, web, worker) | [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) |
| Service (внутренняя связность) | [Services](https://kubernetes.io/docs/concepts/services-networking/service/) |
| Ingress (замена gateway снаружи) | [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) |
| Probes | [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) |
| Ресурсы | [Manage Resources for Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) |
| Secrets / ConfigMap | [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/), [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/) |
| PVC (Keycloak, MinIO) | [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/) |
| Job (bootstrap) | [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) |
| Доступ к внешней БД | [Services without selectors](https://kubernetes.io/docs/concepts/services-networking/service/#services-without-selectors) + Endpoints |
| Compose → K8s (справочно) | [Translate a Docker Compose File to Kubernetes Resources](https://kubernetes.io/docs/tasks/configure-pod-container/translate-compose-kubernetes/) |
| Keycloak в K8s | [Keycloak — Kubernetes](https://www.keycloak.org/server/kubernetes) (образ и probes для 26.x) |

Helm/Kustomize в этом документе **не обязательны** на первом этапе: достаточно манифестов + `kubectl apply`; GitOps (Flux) — следующий шаг после пилота (с учётом **R-H1** — без неконтролируемого autodeploy на prod).

---

## 4. Соответствие требованиям СБ при развёртывании в Kubernetes

Каталог СБ изначально описан для **Docker Compose + reverse proxy на VPS**; при переносе в K8s **формулировки R-*** не меняются — меняется способ реализации. В репозитории приложения статус выполнения ведётся в **`docs/security-sb-checklist.md`** (создать **до** первого `kubectl apply` пилота): построчно все строки [CHECKLIST.md](https://github.com/vvv-web/security-board-requirements/blob/main/docs/CHECKLIST.md) (колонки R-A1 … R-H5, R-J1, R-J2); канон формулировок — только `security-board-requirements`.

### 4.0. Gate: два уровня «зелёного» (после PIVOT v0.5)

| Уровень | Когда зачтён | См. DoD |
|---------|--------------|---------|
| **Функциональный пилот** | Login, Flyway, Jobs G4/G4b без `[FAIL]`, readiness **`/health`**, VPS prod не тронут | **§8.1a** |
| **SB-пилот** | Все применимые **R-*** ✅ (или N/A + обоснование), **R-J2** согласован, пакет **R-H4**, NetworkPolicy/AMQPS/digest | **§8.2** |

**Не смешивать:** успешный OIDC login **≠** закрытие §8.2. Отчёт «пилот готов» для миграции prod — только после **8.1a + 8.2**.

Общие инварианты на обоих уровнях:

- Отдельная тестовая БД пилота (**in-cluster Postgres**, §5.C) — **R-D1–R-D3** с TLS и NetworkPolicy.
- Нет «временных» манифестов с `:latest`, `start-dev`, guest/guest на overlay `pilot` после hardening.
- **`docs/security-sb-checklist.md`** ведётся с первого `kubectl apply` (статусы обновляются по мере закрытия R-*).

### 4.1. Особенность AcomOfferDesk (файлы)

В коде есть **`UploadFile`** (заявки, офферы, нормативные файлы) → **R-J1 не N/A**. Для **любого** K8s-контура, включая learn на pop-os, обязателен **R-J2** (allowlist, лимиты, карантин, согласование ИБ) или **задокументированное отклонение** в таблице «Известные отклонения». Object storage (MinIO) — по **R-F1–R-F4**; проверка **`MINIO_ROOT_USER` ≠ Linux root** через `kubectl exec … id -u` (**R-F3**).

### 4.2. Матрица: требование СБ → реализация в K8s

| ID | Суть (кратко) | Реализация в Kubernetes (AcomOfferDesk) | Проверка (ориентир) |
|----|---------------|----------------------------------------|---------------------|
| **R-A1** | Внутренние сервисы не на `0.0.0.0` хоста | Только **ClusterIP** / headless; **без** `NodePort`/`LoadBalancer` для backend, Keycloak, RabbitMQ, MinIO, Postgres | `kubectl get svc -n acom-offer-desk-pilot`; `ss -tlnp` на node — нет лишних портов приложения |
| **R-A2** | TLS на edge | **Ingress** + TLS (cert-manager или корп. сертификат); `KEYCLOAK_*` public URL = FQDN Ingress | `curl -vI https://<fqdn>/` |
| **R-A3** | Сегментация сетей | **NetworkPolicy**: ingress → app; app → data; deny egress из «data» в интернет; отдельные labels `tier: edge|app|data` | `kubectl describe networkpolicy` |
| **R-B1** | Keycloak `start`, не `start-dev` | `args: ["start", "--import-realm"]` в Deployment/StatefulSet | `kubectl get pod keycloak -o jsonpath='{.spec.containers[0].args}'` |
| **R-B2** | non-root | `securityContext`: `runAsNonRoot: true`, `runAsUser: 65532` (или UID образа); PVC с `fsGroup` | `kubectl exec … -- id -u` ≠ 0 |
| **R-B3** | digest образов | `image: registry/…/backend@sha256:…` в манифестах prod/pilot | нет `:latest` в overlay `prod` |
| **R-B4** | без Swagger в prod | отдельный readiness path **`/health`** (не `/docs`); `APP_ENV=production`, флаги отключения OpenAPI | smoke без публичного `/docs` |
| **R-C1** | секреты не в git | **Secret** / SealedSecret / External Secrets; в git только `secrets.example.yaml` с ключами без значений | `git grep` паролей |
| **R-C2** | секреты на сервере 0600 | Secret создаётся оператором; RBAC `get secrets` ограничен; не логировать env в Events | audit политика кластера |
| **R-C3** | нет guest/guest | тот же **скрипт инвариантов**, что для compose (адаптировать под rendered manifests) | CI job на `kustomize build` |
| **R-C4** | bootstrap без plaintext в репо | **Job** `keycloak-bootstrap` из env Secret; realm-import без паролей | логи Job |
| **R-D1** | TLS на Postgres | `DATABASE_URL` с `sslmode=verify-full` (или строже); TLS на сервере БД | `SHOW ssl` в Postgres |
| **R-D2** | verify CA БД | CA в Secret volume → `sslrootcert` в URL | подключение backend |
| **R-D3** | изоляция данных | Postgres **вне** pod приложения; NetworkPolicy только от backend/worker | — |
| **R-E1** | свои учётки RabbitMQ | Secret `RABBITMQ_*`; URL в env backend/worker | — |
| **R-E2** | только AMQPS в prod | RabbitMQ: `listeners.tcp = none`, TLS listener; `CELERY_BROKER_URL=amqps://…` | `rabbitmq-diagnostics listeners` в pod |
| **R-E3** | TLS verify не off | без `verify=none` в клиентах | код + rendered config |
| **R-F1** | MinIO non-root + TLS | StatefulSet + TLS certs volume; **R-F3** UID | `id -u` в pod minio |
| **R-F2** | CA verify для S3 SDK | env trust store, без `cert_check=False` | код `backend` storage |
| **R-F4** | MinIO — серверные + бизнес-файлы | явно описать в чеклисте: бизнес-upload в MinIO **согласовано** по **R-J2** | см. §4.1 |
| **R-G1** | Keycloak hostname strict | `KC_HOSTNAME`, proxy headers на Ingress ([Keycloak hostname](https://www.keycloak.org/server/hostname)) | login redirect |
| **R-G2** | 2FA контрольных ролей | realm policy без изменений при миграции; live test после cutover | чеклист проекта |
| **R-G3** | JWT aud (если требует ИБ) | настройки backend без ослабления | — |
| **R-H1** | нет autodeploy без approved | Flux **не** на prod без процесса; пилот — ручной `kubectl apply` / одобренный pipeline | нет cron `git pull` на VPS для K8s |
| **R-H2** | фиксация SHA | в release: image digest + git commit манифестов | runbook |
| **R-H3** | отдельный prod profile | `deploy/k8s/overlays/pilot` vs `prod`; не dev env в prod overlay | kustomize |
| **R-H4** | пакет для ИБ | чеклист + `kubectl get`/`describe` (без Secret values) + SBOM образов | папка `docs/security/` |
| **R-H5** | deps/CVE | lock-файлы в образах; digest при выкате | CI |
| **R-J2** | upload — план ИБ | **обязательно** до закрытия пилота (не откладывать на prod cutover) | чеклист + согласование ИБ |

Организационные **O-1…O-5** ([ORGANIZATIONAL.md](https://github.com/vvv-web/security-board-requirements/blob/main/docs/ORGANIZATIONAL.md)) — зона ИБ/ЦОД; в roadmap фиксируем зависимость: без **O-1** (443 снаружи) Ingress бессмысленен.

### 4.3. Дополнительные шаги в этапах A–G (только из-за СБ)

| Этап | Добавить к базовому шагу |
|------|---------------------------|
| **A2** | Ingress class + TLS secret; запрет публикации сервисов типа LoadBalancer для app |
| **A3** | Namespace labels для NetworkPolicy; опционально `Pod Security Standards` / restricted |
| **B1** | Secret keys по [production-env.md](../release/production-env.md); не коммитить values |
| **D1–D3** | Keycloak/MinIO: `securityContext` + PVC backup перед сменой UID (**R-B2**) |
| **E1** | Prod overlay: readiness **не** на `/docs` если R-B4 (**R-B4**) |
| **F1** | TLS Ingress + корректные `X-Forwarded-*` для Keycloak (**R-A2**, **R-G1**) |
| **G** | Прогнать универсальные проверки из [VERIFICATION.md](https://github.com/vvv-web/security-board-requirements/blob/main/docs/VERIFICATION.md), substituting `kubectl`/`docker` где нужно |

Пример проверки non-root в кластере (аналог VERIFICATION.md):

```bash
kubectl -n acom-offer-desk-pilot exec deploy/backend -- id -u
kubectl -n acom-offer-desk-pilot exec deploy/minio -- id -u
kubectl -n acom-offer-desk-pilot get networkpolicy
```

### 4.4. Пакет доказательств для ИБ (R-H4) при K8s-пилоте

Перед показом руководителю / ИБ собрать **без секретов**:

1. Заполненный [CHECKLIST.md](https://github.com/vvv-web/security-board-requirements/blob/main/docs/CHECKLIST.md) проекта (`docs/security-sb-checklist.md`).
2. `kustomize build deploy/k8s/overlays/pilot` (манифесты без Secret data).
3. Список образов с digest: `kubectl get pods -o jsonpath='{..image}' | tr ' ' '\n' | sort -u`.
4. Этот roadmap + [environments.md](./environments.md) (периметр).
5. Таблица отклонений — **пустая** или с подписанными ИБ пунктами (не «в процессе»).

### 4.5. Порядок работ (СБ + K8s)

```text
1. docs/security-sb-checklist.md — таблица R-* (статусы ❌/⚠️/✅/N/A)
2. deploy/k8s/pilot/ — каталог создан (v0.5); первый PR может быть skeleton (.example + README)
3. A0: build/push + digest; копировать .example → рабочие yaml без суффикса (секреты вне git)
4. kubectl apply → функциональный пилот (§8.1a)
5. Итеративный hardening → SB-пилот (§8.2) + VERIFICATION.md
6. План cutover prod с VPS
```

**Skeleton PR допустим** до полного hardening: namespace, ingress.example, jobs/*.example, secrets.example — без реальных значений; gate §8.2 не закрывается до ✅ по чеклисту.

---

## 5. Шаги развёртывания Kubernetes (по порядку)

Каждый шаг — **одно действие**, проверка, затем следующий. Команды выполняет оператор на стенде с `kubectl`.

### Этап A0. Registry и образы (до манифестов)

| Шаг | Действие | СБ | Проверка |
|-----|----------|-----|----------|
| A0.1 | С `upstream/test` @ **`AOD_DEPLOY_SHA`**: build `backend`, `web`, `notifications_worker` | **R-H2** | `git rev-parse HEAD` записан в runbook |
| A0.2 | Push в registry (on-prem / корп.); в манифестах **`image@sha256:…`** | **R-B3** | нет `:latest` в overlay pilot |
| A0.3 | Label/annotation `acom.deploy/sha=$AOD_DEPLOY_SHA` на Deployments/Jobs | **R-H2** | `kubectl get deploy -o yaml \| grep deploy/sha` |

Скрипт-ориентир: `deploy/k8s/pilot/scripts/build-images.sh.example`.

### Этап A. Подготовка кластера

| Шаг | Действие | Оф. опора | Проверка |
|-----|----------|-----------|----------|
| A1 | Установить/подтвердить кластер (например **k3s**), `kubectl cluster-info` | [Install tools](https://kubernetes.io/docs/tasks/tools/) | `kubectl get nodes` Ready |
| A2 | Установить **Ingress Controller** (nginx — как в [environments](./environments.md)) | [Ingress Controllers](https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/) | `kubectl -n ingress-nginx get pods` |
| A3 | Создать namespace, например `acom-offer-desk-pilot` | [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/) | `kubectl get ns` |
| A4 | (Рекомендуется) Установить **metrics-server** | [metrics-server](https://github.com/kubernetes-sigs/metrics-server) | `kubectl top nodes` |

### Этап B. Секреты и конфигурация (до Pod’ов)

| Шаг | Действие | Что перенести из проекта |
|-----|----------|---------------------------|
| B1 | Создать **Secret** из `backend/.env` (не коммитить): `DATABASE_URL`, `JWT_*`, `KEYCLOAK_*`, MinIO, RabbitMQ | [production-env.md](../release/production-env.md), `.env.example` |
| B2 | Создать **ConfigMap** для несекретных env (`APP_ENV`, публичные URL, `KEYCLOAK_REALM`) | `backend/app/core/config.py` — список полей |
| B3 | Подставить **внутренние URL** для K8s DNS: `KEYCLOAK_INTERNAL_BASE_URL=http://keycloak:8080/iam` (имя `Service` keycloak) | [auth-and-onboarding.md](../security/auth-and-onboarding.md) |
| B4 | **Фаза 1 learn:** `DATABASE_URL` **только** на in-cluster Postgres пилота (этап C). Подключение K8s к prod Postgres на VPS **не используется**; parity с VPS-БД — фаза 2+ по решению ИБ | §6 фаза 1, этап C |

Оф. дока: [Managing Secrets](https://kubernetes.io/docs/tasks/configmap-secret/).

### Этап C. PostgreSQL пилота (отдельная БД, с TLS — R-D1–R-D3)

**Не** prod VPS. Тестовый Postgres **в namespace пилота** (или изолированный compose только для generate TLS certs + flyway Job в K8s).

| Шаг | Действие | СБ | Оф. опора |
|-----|----------|-----|-----------|
| C1 | StatefulSet Postgres + PVC; сеть **data** tier, NetworkPolicy | R-D3, R-A3 | [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) |
| C2 | Включить **SSL** на сервере БД, сертификаты в Secret (read-only mount) | **R-D1** | PostgreSQL [SSL](https://www.postgresql.org/docs/current/ssl-tcp.html) |
| C3 | `DATABASE_URL` с **`sslmode=verify-full`** + CA в URL/volume | **R-D2** | |
| C4 | Job **Flyway migrate** из `deploy/order_database/flyway/sql` | R-H2 | [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/) |
| C5 | SQL-проверки из deploy.yml: `user_auth_accounts`, … | — | [order-database-vps.md](./order-database-vps.md) |

### Этап D. Stateful и инфра внутри namespace

| Шаг | Workload | Storage | Probes (ориентир из compose) |
|-----|----------|---------|------------------------------|
| D1 | **Keycloak** Deployment или StatefulSet, образ `26.5` | PVC для `/opt/keycloak/data` | readiness: HTTP `/health/ready` на management port ([Keycloak health](https://www.keycloak.org/server/health)) |
| D2 | **RabbitMQ** Deployment + PVC при необходимости; **R-E2/R-E3:** `listeners.tcp = none`, TLS listener, `CELERY_BROKER_URL=amqps://…` (parity `docker-compose.vps.yml` / VPS runbook) | **R-E2**, **R-E3** | `rabbitmq-diagnostics listeners` в pod |
| D3 | **MinIO** Deployment + PVC | `minio_data` | readiness: `GET /minio/health/ready` |
| D4 | **Import realm:** по умолчанию в **entrypoint** Deployment Keycloak: `start --import-realm` (как compose). Отдельный Job `keycloak-import` — **только если** import нельзя встроить в lifecycle pod | — | realm доступен после Ready |
| D5 | **Job** bootstrap: `keycloak_bootstrap` + `keycloak_user_role_sync` из **`docker-compose.init.yml`**; скрипт **`infra/keycloak/bootstrap.sh` с SHA ветки `test`** | — | логи без ERROR |
| D5b | После подъёма app: Job по логике **`scripts/keycloak-init-deploy.sh`** (skip bootstrap если model OK) | — | как на VPS deploy |

Оф. дока: [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) если нужен стабильный identity для Keycloak.

### Этап E. Приложение

| Шаг | Workload | Service | Probes |
|-----|----------|---------|--------|
| E1 | **backend** Deployment, образ **@ digest** из A0 | ClusterIP :8000 | readiness: **`GET /health`**; `APP_ENV=production`; публичный `/docs` недоступен (**R-B4**) |
| E2 | **web** Deployment | ClusterIP :80 | readiness: nginx + static |
| E3 | **notifications_worker** Deployment | без Ingress | liveness по процессу |
| E4 | **gateway** — вариант 1: Deployment nginx + ConfigMap из `backend/nginx.conf` | ClusterIP :80 | depends логически через readiness цепочки |
| E4alt | **gateway** — вариант 2: убрать pod gateway, маршруты задать в **Ingress** (три path) | — | [Ingress paths](https://kubernetes.io/docs/concepts/services-networking/ingress/#path-types) |

`requests` / `limits`: начать с замеров `kubectl top pod` после 24–48 ч; минимум задать `requests` чтобы scheduler не клал все Pod на один node ([Resource quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/) — при необходимости).

### Этап F. Внешний вход

| Шаг | Действие |
|-----|----------|
| F1 | Ingress: host пилота (например `aod-pilot.example.com`), TLS — cert-manager или корпоративный сертификат |
| F2 | Аннотации/path: `/` → web, `/api` → backend, `/iam` → keycloak (как [runtime-architecture](../product/runtime-architecture.md)) |
| F3 | Публичные URL в env: `KEYCLOAK_PUBLIC_*`, redirect URIs в realm — **сверить** с новым host ([Keycloak hostname](https://www.keycloak.org/server/hostname)) |

### Этап G. Проверка после развёртывания

| Шаг | Действие | Артефакт в репо |
|-----|----------|-----------------|
| G1 | `kubectl get pods -n acom-offer-desk-pilot` — все Running/Completed | — |
| G2 | Smoke внутри кластера: `curl -sf http://backend:8000/health` → 200; `/docs` — 404/403 на pilot overlay | **R-B4** |
| G3 | С хоста: HTTPS login → OIDC callback → API | [testing-strategy.md](../development/testing-strategy.md) |
| G4 | **K8s Job** `post-deploy-verify` (образ backend **@digest**, `restartPolicy: Never`, `activeDeadlineSeconds`): запуск `post-deploy-verify.sh` **внутри pod** — **без** `docker compose exec`. Env: `POST_DEPLOY_BASE_URL=https://<pilot-fqdn>`, те же проверки что VPS | `deploy/k8s/pilot/jobs/post-deploy-verify.job.yaml.example` |
| G4b | Keycloak: `run-keycloak-check-backend.sh` / `check_keycloak_permission_model.py` — без `[FAIL]` | как на VPS после deploy |
| G5 | Backend unit/smoke: `backend/app/scripts/smoke_services.py` (если доступен из Job) | — |

### 5.5. Приложение: полный список путей каталога `deploy/k8s/`

```text
deploy/k8s/
  README.md
  pilot/
    README.md
    namespace.yaml
    kustomization.yaml
    config/
      configmap.example.yaml
      secrets.example.yaml
    jobs/
      README.md
      flyway-migrate.job.yaml.example
      keycloak-db-prepare.job.yaml.example
      keycloak-bootstrap.job.yaml.example
      keycloak-user-role-sync.job.yaml.example
      keycloak-init-deploy.job.yaml.example
      post-deploy-verify.job.yaml.example
    workloads/
      README.md
      keycloak.yaml.example
      backend.yaml.example
      web.yaml.example
      notifications-worker.yaml.example
      rabbitmq.yaml.example
      minio.yaml.example
    networking/
      README.md
      ingress.yaml.example
      networkpolicy.yaml.example
    data/
      README.md
      postgres-statefulset.yaml.example
    scripts/
      README.md
      build-images.sh.example
      pre-apply-check.sh.example
  overlays/
    README.md
docs/security-sb-checklist.md
```

---

## 6. Шаги миграции с Docker (VPS) на Kubernetes

Миграция = **параллельный пилот**, не замена prod compose до прохождения чеклиста.

### Фаза 0 — Инвентаризация (без изменений prod)

1. Зафиксировать версии образов на VPS: `docker compose images`.
2. Экспорт **только имён** переменных из `backend/.env` (без значений в git).
3. Снимок схемы БД: `pg_dump` (как в deploy.yml) — [order-database-vps.md](./order-database-vps.md).
4. Записать публичный URL, realm, redirect URIs Keycloak.

### Фаза 1 — Пилотный namespace (learn / pop-os)

1. Развернуть этапы **A–G** на отдельном host/Ingress (например `aod-pilot.local` → `127.0.0.1`).
2. **БД — только отдельный тестовый контур** (обязательно для learn на pop-os):
   - **не** подключать K8s к prod Postgres на VPS;
   - поднять **свою** `order_database` (Flyway из `deploy/order_database/flyway/sql`) — в Docker на `project_net` **или** Postgres в кластере (StatefulSet + PVC) только для пилота;
   - данные пустые/seed — достаточно для проверки login, API, smoke; перенос prod-данных — **отдельная фаза** перед cutover.
3. Keycloak: отдельный realm-import + bootstrap (свои redirect URI под host пилота).
4. RabbitMQ, MinIO — в том же namespace пилота (отдельные volume от VPS).
5. **VPS prod не трогать:** `/opt/acome-offer-desk`, `/opt/order_database` без изменений.

Цель фазы 1: **доказать**, что стек в Kubernetes **работает** и **проходит полный чеклист СБ** (§4.0) — не мигрировать prod.

Подключение K8s к Postgres **на VPS** для learn **не используется**. Staging/parity с VPS-БД — отдельная фаза после зелёного пилота и решения ИБ.

Оф. подход «соседство старого и нового»: новый Ingress host; VPS `gateway:8080` без изменений ([Deploy and manage workloads](https://kubernetes.io/docs/concepts/cluster-administration/manage-deployment/)).

### Фаза 2 — Сверка поведения (parity)

| Область | Docker (эталон) | K8s (пилот) |
|---------|-----------------|-------------|
| Login / callback | `/api/v1/auth/callback` 200 | то же |
| Health | gateway → backend **`/health`** (VPS compose может ещё использовать `/docs` в healthcheck) | Ingress → backend **`/health`** (**R-B4**) |
| Worker | очередь RabbitMQ обрабатывается | метрики/логи worker |
| Файлы | MinIO upload/download | то же bucket/policy |
| Миграции | flyway после deploy | Job flyway до/после rollout |

При расхождении — сначала env/URL Keycloak, затем `DATABASE_URL`, затем сеть до Postgres ([debug Services](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)).

### Фаза 3 — Переключение трафика (только после согласования)

1. Окно обслуживания: бэкап БД + образов.
2. DNS/edge proxy: с VPS `127.0.0.1:8080` на Ingress K8s **или** постепенный canary.
3. Повтор **G3–G4**.
4. Мониторинг 24–48 ч; откат — см. §7.

### Фаза 4 — (Опционально) Postgres в кластере

Отдельное решение: StatefulSet + оператор/ручной Postgres, перенос данных, cutover `DATABASE_URL`. До этого момента оф. рекомендация проекта — внешний `order_database` ([runtime-architecture](../product/runtime-architecture.md)).

---

## 7. Откат

| Ситуация | Действие |
|----------|----------|
| Пилот не прошёл smoke | Удалить Ingress пилота; prod compose на VPS без изменений |
| После cutover критичный сбой | DNS обратно на VPS gateway; `docker compose up -d` по [environments](./environments.md) |
| Плохая миграция БД | Восстановление из `pg_dump` в `/opt/order_database/backups/` |

Оф. дока rollout: [Rolling Update Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment) — `kubectl rollout undo deployment/backend`.

---

## 8. DoD пилота (разделено: функциональность → СБ)

### 8.1a. Функциональный пилот (первая «зелёная» веха)

- [ ] **A0:** образы backend/web/worker с **`upstream/test`** @ **`AOD_DEPLOY_SHA`**, digest в манифестах
- [ ] In-cluster Postgres + Flyway Job Complete; SQL checks (`user_auth_accounts`, …)
- [ ] Keycloak chain: bootstrap/sync/init Jobs (или эквивалент entrypoint) без ERROR
- [ ] Rollout backend/web/worker Ready; readiness **`/health`** = 200
- [ ] Ingress: login → OIDC callback → API
- [ ] **Job** `post-deploy-verify` + Keycloak permission check — без `[FAIL]` (не `compose exec`)
- [ ] Prod VPS compose **не изменяли**; URL пилота и откат (§7) задокументированы

**Зачёт:** можно демонстрировать стек в K8s; **не** достаточно для cutover prod.

### 8.2. SB-пилот (полный чеклист, итеративно после 8.1a)

- [ ] **`docs/security-sb-checklist.md`**: **R-A1 … R-H5**, **R-J1**, **R-J2** — **✅** или **N/A**; **❌/⚠️** только в «Известные отклонения» + ИБ
- [ ] [VERIFICATION.md](https://github.com/vvv-web/security-board-requirements/blob/main/docs/VERIFICATION.md) (адаптация `kubectl` / `ss -tlnp`)
- [ ] **R-J2** — план upload + меры согласованы (AcomOfferDesk **не** N/A по upload)
- [ ] NetworkPolicy, AMQPS, TLS Postgres, non-root, без публичного `/docs`
- [ ] Пакет **R-H4** (§4.4)

**Зачёт:** пилот готов к планированию миграции prod (фаза 3). Login без §8.2 **не** считается готовностью к cutover.

---

## 9. Каталог артефактов K8s (создан в v0.5)

Канонический дом для всех манифестов пилота и будущих overlay:

| Путь | Назначение |
|------|------------|
| `deploy/k8s/README.md` | Индекс pilot vs `overlays/` |
| `deploy/k8s/pilot/` | Kustomize base пилота (pop-os learn) |
| `deploy/k8s/pilot/jobs/*.yaml.example` | Jobs: flyway, Keycloak, post-deploy |
| `deploy/k8s/pilot/workloads/*.yaml.example` | Deployments |
| `deploy/k8s/pilot/networking/` | Ingress, NetworkPolicy |
| `deploy/k8s/pilot/data/` | Postgres StatefulSet |
| `deploy/k8s/pilot/config/` | ConfigMap/Secret **examples** (без значений) |
| `deploy/k8s/pilot/scripts/` | build-images, pre-apply-check |
| `deploy/k8s/overlays/` | Заготовка prod overlay |
| `docs/security-sb-checklist.md` | Статус **R-*** для ИБ |

Файлы с суффиксом **`.example`** — шаблоны; перед apply копировать в yaml без `.example` и подставить env (секреты — только из Secret на кластере, **R-C1**).

Подробный список — **§5.5**.

---

## 10. Связанные документы проекта

| Документ | Зачем |
|----------|--------|
| [runtime-architecture.md](../product/runtime-architecture.md) | Потоки и роли сервисов |
| [environments.md](./environments.md) | dev/test/prod, периметр |
| [order-database-vps.md](./order-database-vps.md) | Flyway, prerequisite deploy |
| [auth-and-onboarding.md](../security/auth-and-onboarding.md) | Keycloak clients, callback |
| [testing-strategy.md](../development/testing-strategy.md) | post-deploy smoke |
| [vps-troubleshooting.md](./vps-troubleshooting.md) | 502, gateway после recreate |
| [security-board-requirements](https://github.com/vvv-web/security-board-requirements) | Канон требований СБ (R-*) |

---

**Версия:** 2026-05-20 (v0.5 — PIVOT по [консилиуму](../../../../consilium/2026-05-19-acom-k8s-migration-plan.md): split DoD, каталог `deploy/k8s/`, `/health`, in-cluster Postgres)

**Синтез консилиума (PIVOT):** сохранить цель K8s-пилота; изменить исполнение — двухфазный DoD (8.1a функциональный / 8.2 полный СБ), убрать противоречие B4, единый readiness **`/health`**, DAG Jobs как в `deploy.yml`, registry как этап A0, `post-deploy-verify` только через K8s Job (не `docker compose exec`).
