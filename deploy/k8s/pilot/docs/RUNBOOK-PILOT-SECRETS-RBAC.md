# Runbook: секреты и RBAC пилота (R-C2)

**Namespace:** `acom-offer-desk-pilot`  
**Аналог VPS:** `/etc/acome-offer-desk/backend/.env` chmod **600** — в K8s это **Secret + RBAC**, не файл на ноде.

## Кто создаёт Secret

| Роль | Кто | Как |
|------|-----|-----|
| **Оператор пилота** | DevOps с kubeconfig на pop-os k3s | `./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh` (или `kubectl create secret` + label) |
| **GitOps (Flux)** | Не создаёт значения Secret | В git только `config/secrets.example.yaml` без значений |
| **Runtime (backend/worker)** | ServiceAccount `acom-pilot-runtime` | **Не** вызывает API `secrets` — значения монтирует kubelet через `envFrom` |

**VPS prod (`/opt/acome-offer-desk`) не трогаем** — этот runbook только для learn-пилота.

## RBAC (манифест `rbac/secrets-rbac.yaml`)

| ServiceAccount | Назначение | `get secrets` |
|----------------|------------|---------------|
| `acom-pilot-runtime` | backend, web, notifications-worker, Jobs | **нет** |
| `acom-pilot-data` | postgres, rabbitmq, minio, keycloak | **нет** |
| `acom-pilot-secrets-operator` | ротация/создание Secret оператором | **да** (только `acom-app-secrets`, `postgres-tls`, `acom-pilot-tls`) |

Проверка:

```bash
NS=acom-offer-desk-pilot
kubectl auth can-i get secrets --as=system:serviceaccount:${NS}:acom-pilot-runtime -n "$NS"
# no

kubectl auth can-i get secrets --as=system:serviceaccount:${NS}:acom-pilot-secrets-operator -n "$NS"
# yes
```

Оф. дока RBAC: https://kubernetes.io/docs/reference/access-authn-authz/rbac/

## Создание / обновление секретов

1. Подготовить значения **локально** (файл `backend/.env` chmod **600**, не коммитить).
2. Экспортировать переменные `PILOT_PG_PASSWORD`, `PILOT_JWT_SECRET`, … (см. `apply-pilot-secrets.sh`).
3. **Без учебных плейсхолдеров** (SB): не задавать `PILOT_ALLOW_LEARN_PLACEHOLDERS=1`.
4. Запустить:

```bash
./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh
```

5. Перезапуск подов, если менялись ключи в `acom-app-secrets`:

```bash
kubectl -n acom-offer-desk-pilot rollout restart deployment/backend deployment/keycloak deployment/notifications-worker
```

## Плейсхолдеры (learn-only)

- В git: `config/secrets.example.yaml` — только `CHANGE_ME_*`.
- Скрипт `apply-pilot-secrets.sh` по умолчанию **отказывается** от значений `*_change_me`, если не задан `PILOT_ALLOW_LEARN_PLACEHOLDERS=1`.
- Учебный Secret помечается: label `acom.security/learn-placeholder=true`.

## Запреты (R-C2)

- Не печатать значения Secret в чат, CI-логи, Events.
- Не коммитить `backend/.env` и rendered Secret с данными.
- Не давать runtime SA права `get/list secrets` через RoleBinding.

## Верификация шага 6

```bash
./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step6.sh
```
