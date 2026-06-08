# SB Step 6 — Secrets RBAC + placeholder hardening (R-C2)

**Дата:** 2026-06-08  
**Namespace:** `acom-offer-desk-pilot`  
**Ветка:** `k8s-pilot-popos` @ `f812f48`  
**VPS prod:** не трогали

## Что задеплоено

| Ресурс | Изменение | R-* |
|--------|-----------|-----|
| `rbac/secrets-rbac.yaml` | SA runtime/data/operator; Role без secrets для runtime | R-C2 |
| `docs/RUNBOOK-PILOT-SECRETS-RBAC.md` | кто создаёт Secret, проверки `auth can-i` | R-C2 |
| `workloads/*.yaml`, `data/postgres-statefulset.yaml` | `serviceAccountName` runtime/data | R-C2 |
| `scripts/apply-pilot-secrets.sh` | guard `PILOT_ALLOW_LEARN_PLACEHOLDERS`; label `managed-by` | R-C2 |
| `config/secrets.example.yaml` | только `CHANGE_ME_*` | R-C1/R-C2 |

**Оф. RBAC:** https://kubernetes.io/docs/reference/access-authn-authz/rbac/

## Верификация

```bash
./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step6.sh
```

| Тест | Результат |
|------|-----------|
| S6-T1 kustomize RBAC | **PASS** |
| S6-T2 runbook | **PASS** |
| S6-T3 backend SA runtime | **PASS** |
| S6-T4 operator Role resourceNames | **PASS** |
| S6-T5 secrets.example placeholders | **PASS** |
| S6-T6 apply script guard | **PASS** |
| S6-T7 runtime SA no get secrets | **PASS** |
| S6-T8 operator SA get named secret | **PASS** |
| S6-T9 default SA no get secrets | **PASS** |
| S6-T10 live backend SA | **PASS** |
| S6-T11 secret managed-by label | **PASS** |

**SUMMARY:** pass=11 fail=0 skip=0 → **PASS** (повторный прогон после live remediation)

## Live remediation (S6-T10)

**Симптом:** в git/kustomize уже был `serviceAccountName: acom-pilot-runtime`, но live `Deployment/backend` (и web, notifications-worker) шли с пустым SA → S6-T10 **FAIL**.

**Исправление (2026-06-08):**

```bash
export KUBECONFIG=~/.kube/config
kubectl apply -k deploy/k8s/pilot
kubectl -n acom-offer-desk-pilot rollout restart \
  deploy/backend deploy/web deploy/notifications-worker \
  deploy/keycloak deploy/minio deploy/rabbitmq sts/postgres
./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step6.sh
```


**Keycloak (2026-06-08):** заявка SA `acom-pilot-data` для keycloak **корректна** после rollout; падение было из‑за отсутствия DB schema `keycloak`, не из‑за ServiceAccount.
**Live SA после rollout:** backend/web/notifications-worker → `acom-pilot-runtime`; keycloak/minio/rabbitmq/postgres → `acom-pilot-data`.

## Операции

```bash
./deploy/k8s/pilot/flux-phases/sync-hardlinks.sh
kubectl apply -f deploy/k8s/pilot/rbac/secrets-rbac.yaml
PILOT_ALLOW_LEARN_PLACEHOLDERS=1 ./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh
kubectl apply -k deploy/k8s/pilot
git push origin k8s-pilot-popos
flux reconcile source git acomofferdesk -n flux-system
flux reconcile kustomization pilot-base -n flux-system --with-source
flux reconcile kustomization pilot-apps -n flux-system --with-source
```

**Flux (2026-06-08):** `pilot-base` Ready @ `f812f48` (RBAC в GitOps); `pilot-infra`/`pilot-apps` — reconcile в очереди (зависимость migrate chain).

## Вердикт

**SB Step 6: PASS** — runtime SA без API-доступа к Secret; операторский runbook; placeholder guard в apply-скрипте.

**Следующий фокус:** Шаг 7 (R-C3) — **не начинать без approve**.
