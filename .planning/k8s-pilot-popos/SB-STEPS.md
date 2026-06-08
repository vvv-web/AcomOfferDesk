# SB-пилот K8s — пошаговый план (июнь 2026)

**Цель MBO:** тестовый AcomOfferDesk в K8s **без prod** + **полный чеклист R-*** ([§8.2 roadmap](../../docs/operations/kubernetes-migration-roadmap.md)).

**Не смешивать:** §8.1a (функция/login) и §8.2 (СБ) — оба нужны для «пилот готов».

| Шаг | Что делаем | R-* / артефакт | Критерий PASS |
|-----|------------|----------------|---------------|
| **0** | Зафиксировать baseline | `docs/security-sb-checklist.md`, `SECURITY-SB-R-MAPPING.md`, Graph RAG | Документы в ветке `k8s-pilot-popos` |
| **1** | Функциональный каркас | R-B3, R-C1, R-H2, R-H5 | Образы в k3s (`ctr images import` или registry+digest); backend/web Running; Flux `pilot-apps` Ready |
| **2** | Edge TLS + hostname | R-A2, R-G1 | Ingress `spec.tls`; Keycloak login redirect на FQDN — **PASS** 2026-06-08 (`verify-k8s-pilot-sb-step2.sh` 7/7)¹ |
| **3** | NetworkPolicy | R-A3, R-D3 | `kubectl get networkpolicy` ≥1; data-tier deny egress — **PASS** 2026-06-08 (`verify-k8s-pilot-sb-step3.sh` 14/14) |
| **4** | Postgres TLS + non-root везде | R-D1, R-D2, R-B2 | `SHOW ssl=on`; `DATABASE_URL` verify-full; rabbitmq securityContext — **PASS** 2026-06-08 (`verify-k8s-pilot-sb-step4.sh`) |
| **5** | Prod profile app | R-B4 | readiness `/health`; `/docs` недоступен снаружи — **PASS** 2026-06-08 (`verify-k8s-pilot-sb-step5.sh`) |
| **6** | Секреты и RBAC | R-C2 | Runbook: кто создаёт Secret; RBAC без лишнего `get secrets` |
| **7** | CI инварианты | R-C3 | `check_k8s_pilot_security.py` на `kustomize build` |
| **8** | RabbitMQ AMQPS | R-E1, R-E2, R-E3 | Нет plaintext 5672 в Service; `amqps://` в worker |
| **9** | MinIO TLS + S3 verify | R-F1, R-F2 | TLS listener; backend без `cert_check=False` |
| **10** | IAM / 2FA smoke | R-G2, R-B1 | Keycloak stable; CONFIGURE_TOTP для контрольной роли |
| **11** | Пакет R-H4 | R-H4 | Заполненный чеклист + `kustomize build` + список digest + этот roadmap |
| **12** | Upload план ИБ | R-J2 | `docs/security/security-upload-k8s-pilot.md` согласован |

После каждого шага: обновить колонку «Пилот K8s» в `docs/security-sb-checklist.md`, строку в `SECURITY-SB-R-MAPPING.md`, checkpoint в `STATE.md`.

**Текущий фокус:** **Шаг 6** — секреты и RBAC (R-C2); шаг 5 закрыт 2026-06-08.

**Шаг 5 (2026-06-08):** **PASS** — R-B4 live; `APP_ENV=production`; OpenAPI off; `verify-k8s-pilot-sb-step5.sh`; см. `SB-STEP5-EVIDENCE.md`.

**Шаг 4 (2026-06-08):** **PASS** — R-D1/R-D2/R-B2 live; `verify-k8s-pilot-sb-step4.sh`; см. `SB-STEP4-EVIDENCE.md`.

**Шаг 3 (2026-06-08):** **PASS** — R-A3/R-D3 live; `networking/networkpolicy.yaml` + tier labels; Flux `pilot-apps` @ `912bcba`; `verify-k8s-pilot-sb-step3.sh` **14/14 PASS** — см. `SB-STEP3-EVIDENCE.md`.

**Шаг 2 (2026-06-08):** **PASS** — R-A2/R-G1 live; Ingress `spec.tls` + FQDN `pilot.acom-offer-desk.ru`; `verify-k8s-pilot-sb-step2.sh` **7/7 PASS** (agents 2081552b, f8ca2d16).

**¹ Footnote (шаг 2):** Flux `pilot-apps` still on git `005a977` until `git push origin k8s-pilot-popos` + `flux reconcile kustomization pilot-infra -n flux-system --with-source` — TLS/hostname applied live in cluster; GitOps parity pending, does not block SB step 2 PASS.
