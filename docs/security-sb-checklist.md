# Чеклист СБ — AcomOfferDesk (K8s пилот и VPS)

**Канон формулировок:** [vvv-web/security-board-requirements](https://github.com/vvv-web/security-board-requirements) — `docs/REQUIREMENTS.md`, `docs/CHECKLIST.md`, `docs/VERIFICATION.md`  
**Локальная копия:** `~/Desktop/security-board-requirements/`

**Этот файл** — только **статус выполнения** для AcomOfferDesk; не дублирует текст требований.

**Среда проверки:** pop-os k3s (learn)  
**Дата:** 2026-06-08  
**Commit / Flux:** `k8s-pilot-popos` @ `005a977`  
**Контур:** ☐ VPS `test` · ☑ K8s pilot `acom-offer-desk-pilot`

**Дорожная карта K8s:** [kubernetes-migration-roadmap.md](./operations/kubernetes-migration-roadmap.md) (v0.5)  
**Маппинг R-* → файлы:** [deploy/k8s/pilot/docs/SECURITY-SB-R-MAPPING.md](../deploy/k8s/pilot/docs/SECURITY-SB-R-MAPPING.md)  
**Пошаговый план:** [.planning/k8s-pilot-popos/SB-STEPS.md](../.planning/k8s-pilot-popos/SB-STEPS.md)

**Статусы:** ❌ не выполнено · ⚠️ частично · ✅ выполнено · N/A не применимо

---

## Технический контур

| ID | Кратко (требование) | Пилот K8s | Доказательство / путь | Примечания |
|----|---------------------|-----------|------------------------|------------|
| R-A1 | Внутренние сервисы не на 0.0.0.0 хоста; снаружи 443/80 | ⚠️ | `workloads/*.yaml` — ClusterIP; `kubectl get svc -n acom-offer-desk-pilot` | Ingress на node; app без NodePort |
| R-A2 | TLS на edge; strict hostname IdP | ✅ | `networking/ingress.yaml` `spec.tls` + `acom-pilot-tls`; HTTPS `/health` → 200 | **Шаг 2 PASS** 2026-06-08 |
| R-A3 | Сегментация сетей (edge/app/data) | ❌ | `networking/networkpolicy.yaml.example` не применён | **Шаг 3** |
| R-B1 | Keycloak `start`, не `start-dev` | ⚠️ | `workloads/keycloak.yaml` args `start` | deploy **1/1 Running** 2026-06-08; bootstrap job — **Шаг 1** / **Шаг 10** |
| R-B2 | Контейнеры non-root | ⚠️ | backend/keycloak/minio 65532; rabbitmq без SC | **Шаг 4** |
| R-B3 | Образы `@sha256`, без `:latest` | ⚠️ | import `acom-*:8ea43577e06e` в k3s (`ctr images import`); `@sha256`/registry — gap | **Шаг 1 PARTIAL** |
| R-B4 | OpenAPI/debug выкл.; readiness `/health` | ❌ | `workloads/backend.yaml` | **Шаг 5** |
| R-C1 | Секреты вне git | ⚠️ | `config/secrets.example.yaml`; Secret `acom-app-secrets` | placeholders — **Шаг 1** |
| R-C2 | Runtime secrets 0600 | ❌ | RBAC + runbook | **Шаг 6** |
| R-C3 | Нет guest/guest в rendered config | ❌ | CI скрипт отсутствует | **Шаг 7** |
| R-C4 | Bootstrap без plaintext в репо | ⚠️ | `jobs/keycloak-bootstrap.job.yaml` | env из Secret |
| R-D1 | TLS на СУБД включён | ⚠️ | `data/postgres-statefulset.yaml` ssl=on; Secret `postgres-tls` | подтвердить `SHOW ssl` |
| R-D2 | Клиенты БД verify-full / CA | ❌ | `DATABASE_URL` в secrets | **Шаг 4** |
| R-D3 | Изоляция данных (data tier) | ❌ | StatefulSet есть; NP нет | **Шаг 3** |
| R-E1 | Свои учётки RabbitMQ | ⚠️ | Secret `RABBITMQ_*` | |
| R-E2 | Только TLS к брокеру (AMQPS) | ❌ | `workloads/rabbitmq.yaml` port **5672** plaintext | **Шаг 8** |
| R-E3 | TLS verify не отключён | ❌ | нет amqps в пилоте | **Шаг 8** |
| R-F1 | MinIO non-root + TLS | ⚠️ | `workloads/minio.yaml` | UID ✅; TLS ❌ **Шаг 9** |
| R-F2 | Клиенты проверяют CA S3 | ❌ | backend storage | **Шаг 9** |
| R-F3 | `MINIO_ROOT_USER` ≠ UID 0 | ✅ | `kubectl exec … minio -- id -u` → 65532 | |
| R-F4 | Object storage — серверные артефакты | ⚠️ | бизнес-файлы в MinIO по R-J2 | |
| R-G1 | Keycloak hostname strict, prod URLs | ✅ | `KC_HOSTNAME=https://pilot.acom-offer-desk.ru/iam`; OIDC redirect на FQDN | **Шаг 2 PASS** 2026-06-08 |
| R-G2 | 2FA контрольных ролей | ❌ | live test | **Шаг 10** |
| R-G3 | JWT audience (если требует ИБ) | ❌ | backend env | |
| R-H1 | Нет autodeploy без approved | ✅ | Flux pilot; VPS deploy по CI | |
| R-H2 | Фиксация SHA / digest | ⚠️ | `acom.deploy/sha` annotation | digest образов ❌ **Шаг 1** |
| R-H3 | Отдельный prod profile | ⚠️ | `pilot/` vs `overlays/` | |
| R-H4 | Пакет доказательств для ИБ | ❌ | чеклист + kustomize build | **Шаг 11** |
| R-H5 | Deps/CVE, lock, пересборка образов | ❌ | образ A0 | **Шаг 1** |
| R-J1 | Нет user upload (или N/A) | ❌ | в коде есть **UploadFile** | **не N/A** для AcomOfferDesk |
| R-J2 | План ИБ при upload | ❌ | документ не создан | **Шаг 12** |

---

## Организационный контур (ИБ / ЦОД)

| ID | Требование | Статус | Владелец |
|----|------------|--------|----------|
| O-1 | Снаружи только 443 (+80) | ☐ | ЦОД/ИБ |
| O-2 | SSH через bastion | ☐ | ИБ |
| O-3 | Разделение ролей | ☐ | ИБ |
| O-4 | Egress git/registry | ☐ | Сеть |
| O-5 | SBOM/скан по регламенту | ☐ | ИБ + команда |

---

## Известные отклонения

| ID | Отклонение | Обоснование | Срок устранения |
|----|------------|-------------|-----------------|
| | | | |

---

## Связь с VPS

На VPS `test` часть пунктов может быть уже ✅ — вести **отдельную** колонку в копии таблицы или второй прогон чеклиста с пометкой «VPS». K8s-пилот закрывается **независимо** по манифестам `deploy/k8s/pilot/`.

**Проверки:** [VERIFICATION.md](https://github.com/vvv-web/security-board-requirements/blob/main/docs/VERIFICATION.md) — substituting `kubectl exec`, `ss -tlnp` на node.

**Graph RAG:** узел `acom_k8s_sb_pilot_plan_jun2026` — план и маппинг зафиксированы 2026-06-05.
