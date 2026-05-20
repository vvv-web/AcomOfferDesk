# Чеклист СБ — AcomOfferDesk (K8s пилот и VPS)

**Канон формулировок:** [vvv-web/security-board-requirements](https://github.com/vvv-web/security-board-requirements) — `docs/REQUIREMENTS.md`, `docs/CHECKLIST.md`, `docs/VERIFICATION.md`  
**Локальная копия:** `~/Desktop/security-board-requirements/`

**Этот файл** — только **статус выполнения** для AcomOfferDesk; не дублирует текст требований.

**Среда проверки:** _______________________  
**Дата:** _______________________  
**Commit / `AOD_DEPLOY_SHA`:** _______________________  
**Контур:** ☐ VPS `test` · ☐ K8s pilot `acom-offer-desk-pilot`

**Дорожная карта K8s:** [kubernetes-migration-roadmap.md](./operations/kubernetes-migration-roadmap.md) (v0.5)  
**Манифесты пилота:** `deploy/k8s/pilot/`

**Статусы:** ❌ не выполнено · ⚠️ частично · ✅ выполнено · N/A не применимо

---

## Технический контур

| ID | Кратко (требование) | Пилот K8s | Доказательство / путь | Примечания |
|----|---------------------|-----------|------------------------|------------|
| R-A1 | Внутренние сервисы не на 0.0.0.0 хоста; снаружи 443/80 | ❌ | `deploy/k8s/pilot/workloads/*.yaml.example` — ClusterIP; `kubectl get svc` | NodePort/LoadBalancer для app запрещены |
| R-A2 | TLS на edge; strict hostname IdP | ❌ | `deploy/k8s/pilot/networking/ingress.yaml.example` | cert-manager или корп. TLS |
| R-A3 | Сегментация сетей (edge/app/data) | ❌ | `deploy/k8s/pilot/networking/networkpolicy.yaml.example` | labels `acom.security/tier` |
| R-B1 | Keycloak `start`, не `start-dev` | ❌ | `deploy/k8s/pilot/workloads/keycloak.yaml.example` — args `start --import-realm` | |
| R-B2 | Контейнеры non-root | ❌ | securityContext в workloads/*.example | `kubectl exec … id -u` |
| R-B3 | Образы `@sha256`, без `:latest` | ❌ | `deploy/k8s/pilot/scripts/build-images.sh.example` | этап A0 roadmap |
| R-B4 | OpenAPI/debug выкл.; readiness `/health` | ❌ | `deploy/k8s/pilot/workloads/backend.yaml.example`; `APP_ENV=production` | не `/docs` в probe |
| R-C1 | Секреты вне git | ⚠️ | `deploy/k8s/pilot/config/secrets.example.yaml` — только ключи | реальный Secret на кластере |
| R-C2 | Runtime secrets 0600 | ❌ | Secret в namespace; RBAC | аналог `/etc/.../.env` на VPS |
| R-C3 | Нет guest/guest в rendered config | ❌ | CI / скрипт инвариантов на `kustomize build` | |
| R-C4 | Bootstrap без plaintext в репо | ❌ | `deploy/k8s/pilot/jobs/keycloak-bootstrap.job.yaml.example` | env из Secret |
| R-D1 | TLS на СУБД включён | ❌ | `deploy/k8s/pilot/data/postgres-statefulset.yaml.example` | in-cluster Postgres пилота |
| R-D2 | Клиенты БД verify-full / CA | ❌ | `DATABASE_URL` в secrets.example | |
| R-D3 | Изоляция данных (data tier) | ❌ | StatefulSet + NetworkPolicy | не общий Postgres на хосте |
| R-E1 | Свои учётки RabbitMQ | ❌ | secrets.example `RABBITMQ_*` | |
| R-E2 | Только TLS к брокеру (AMQPS) | ❌ | `deploy/k8s/pilot/workloads/rabbitmq.yaml.example` | `listeners.tcp = none` |
| R-E3 | TLS verify не отключён | ❌ | `CELERY_BROKER_URL=amqps://…` | |
| R-F1 | MinIO non-root + TLS | ❌ | `deploy/k8s/pilot/workloads/minio.yaml.example` | |
| R-F2 | Клиенты проверяют CA S3 | ❌ | backend storage config | |
| R-F3 | `MINIO_ROOT_USER` ≠ UID 0 | ❌ | runAsUser 65532 в minio.example | |
| R-F4 | Object storage — серверные артефакты | ⚠️ | бизнес-файлы в MinIO по R-J2 | |
| R-G1 | Keycloak hostname strict, prod URLs | ❌ | Ingress FQDN + ConfigMap | |
| R-G2 | 2FA контрольных ролей | ❌ | live test после bootstrap | |
| R-G3 | JWT audience (если требует ИБ) | ❌ | backend env | |
| R-H1 | Нет autodeploy без approved | ✅ | K8s пилот — ручной apply; VPS — deploy.yml по push `test` | Flux prod — позже |
| R-H2 | Фиксация SHA / digest | ❌ | `AOD_DEPLOY_SHA`, annotations `acom.deploy/sha` | pre-apply-check.sh.example |
| R-H3 | Отдельный prod profile | ⚠️ | `deploy/k8s/pilot/` vs `overlays/` | pilot ≠ prod overlay |
| R-H4 | Пакет доказательств для ИБ | ❌ | этот файл + `kustomize build` без Secret data | §4.4 roadmap |
| R-H5 | Deps/CVE, lock, пересборка образов | ❌ | backend/requirements.txt в образе A0 | |
| R-J1 | Нет user upload (или N/A) | N/A | AcomOfferDesk: **есть** `UploadFile` в коде | **не** N/A для продукта |
| R-J2 | План ИБ при upload | ❌ | согласование до закрытия §8.2 roadmap | обязателен до SB-пилота |

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
