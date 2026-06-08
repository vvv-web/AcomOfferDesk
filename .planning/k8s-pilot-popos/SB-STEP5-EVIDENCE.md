# SB Step 5 — prod profile app (R-B4)

**Дата:** 2026-06-08  
**Namespace:** `acom-offer-desk-pilot`  
**Ветка:** `k8s-pilot-popos`  
**VPS prod:** не трогали

## Что задеплоено

| Ресурс | Изменение | R-* |
|--------|-----------|-----|
| `backend/app/main.py` | `docs_url`/`redoc_url`/`openapi_url` = `None` при `APP_ENV=production` | R-B4 |
| `backend/app/core/config.py` | `openapi_enabled` property | R-B4 |
| `workloads/backend.yaml` | `APP_ENV=production`; readiness/liveness `/health` | R-B4 |
| `scripts/apply-pilot-secrets.sh` | ConfigMap `APP_ENV=production` (было `pilot`) | R-B4 |
| `backend/tests/unit/test_prod_openapi_surface.py` | регрессия 4 теста | R-B4 |

**Оф. дока (K8s probes):** https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/ — readiness на отдельном `/health`, не на debug/Swagger.

## Верификация

```bash
cd backend && python3 -m pytest tests/unit/test_prod_openapi_surface.py -q
./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step5.sh
```

| Тест | Результат |
|------|-----------|
| S5-T1 kustomize readiness /health | **PASS** |
| S5-T2 kustomize APP_ENV=production | **PASS** |
| S5-T3 ingress no /docs | **PASS** |
| S5-T4 apply-pilot-secrets production | **PASS** |
| S5-T5 live pod APP_ENV | **PASS** (после rollout) |
| S5-T6 in-cluster /docs → 404 | **PASS** |
| S5-T6b in-cluster /health → ok | **PASS** |
| S5-T7 ingress /docs not 200 | **PASS** |
| S5-T7b ingress /health → 200 | **PASS** |
| S5-T8 live readinessProbe path | **PASS** |
| unit tests | **PASS** 4/4 |

## Операции

```bash
./deploy/k8s/pilot/scripts/build-images.sh
./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh
./deploy/k8s/pilot/flux-phases/sync-hardlinks.sh
git push origin k8s-pilot-popos
flux reconcile source git flux-system -n flux-system
flux reconcile kustomization pilot-infra -n flux-system --with-source
flux reconcile kustomization pilot-apps -n flux-system --with-source
kubectl -n acom-offer-desk-pilot rollout restart deployment/backend
kubectl -n acom-offer-desk-pilot rollout status deployment/backend --timeout=300s
./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step5.sh
```

## Вердикт

**SB Step 5: PASS** — production profile: OpenAPI выключен, readiness на `/health`, `/docs` недоступен снаружи и из кластера.

**Следующий фокус:** Шаг 6 (R-C2) — **не начинать без approve**.
