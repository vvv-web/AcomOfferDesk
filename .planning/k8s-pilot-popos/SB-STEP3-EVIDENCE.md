# SB Step 3 — NetworkPolicy (R-A3, R-D3)

**Дата:** 2026-06-08  
**Namespace:** `acom-offer-desk-pilot`  
**Ветка:** `k8s-pilot-popos` @ `912bcba` (+ verify script fix)  
**VPS prod:** не трогали

## Что задеплоено

| Ресурс | Имя | Назначение |
|--------|-----|------------|
| NetworkPolicy | `deny-data-egress` | Egress для `acom.security/tier=data`: только kube-dns + same-namespace |
| NetworkPolicy | `data-tier-ingress-from-app` | Ingress на data-tier только от `acom.security/tier=app` |
| Labels | postgres, rabbitmq, minio | `acom.security/tier: data` |
| Labels | backend, web, notifications-worker, keycloak | `acom.security/tier: app` |

**Файлы:** `deploy/k8s/pilot/networking/networkpolicy.yaml` · Flux `pilot-apps` via `sync-hardlinks.sh`

**Оф. дока (k8s NetworkPolicy):** https://kubernetes.io/docs/concepts/services-networking/network-policies/ — egress isolation: pod с NP и `policyTypes: Egress` разрешает только перечисленные `egress` rules.

## Верификация

```bash
./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step3.sh
```

| Тест | Результат |
|------|-----------|
| S3-T1 kustomize NetworkPolicy | **PASS** |
| S3-T1b deny-data-egress in build | **PASS** |
| S3-T2 `kubectl get networkpolicy` ≥1 (count=2) | **PASS** |
| S3-T3 deny-data-egress exists | **PASS** |
| S3-T3b policyTypes Egress | **PASS** |
| S3-T4 postgres/rabbitmq/minio tier=data | **PASS** |
| S3-T5 backend/web/worker/keycloak tier=app | **PASS** |
| S3-T6 data pod cannot reach 1.1.1.1 | **PASS** |
| S3-T7 backend `/health` after NP | **PASS** |

**SUMMARY:** pass=14 fail=0 skip=0 → **PASS**

## Live snapshot

```
kubectl -n acom-offer-desk-pilot get networkpolicy
NAME                         POD-SELECTOR
data-tier-ingress-from-app   acom.security/tier=data
deny-data-egress             acom.security/tier=data
```

## Вердикт

**SB Step 3: PASS** — R-A3 сегментация tier + deny internet egress из data; R-D3 ingress data только от app tier.

**Следующий фокус:** Шаг 4 (Postgres TLS verify-full, rabbitmq non-root) — **не начинать без approve**.
