# SB-пилот K8s — пошаговый план (июнь 2026)

**Цель MBO:** тестовый AcomOfferDesk в K8s **без prod** + **полный чеклист R-*** ([§8.2 roadmap](../../docs/operations/kubernetes-migration-roadmap.md)).

**Не смешивать:** §8.1a (функция/login) и §8.2 (СБ) — оба нужны для «пилот готов».

| Шаг | Что делаем | R-* / артефакт | Критерий PASS |
|-----|------------|----------------|---------------|
| **0** | Зафиксировать baseline | `docs/security-sb-checklist.md`, `SECURITY-SB-R-MAPPING.md`, Graph RAG | Документы в ветке `k8s-pilot-popos` |
| **1** | Функциональный каркас | R-B3, R-C1, R-H2, R-H5 | Образы в k3s (`ctr images import` или registry+digest); backend/web Running; Flux `pilot-apps` Ready |
| **2** | Edge TLS + hostname | R-A2, R-G1 | Ingress `spec.tls`; Keycloak login redirect на FQDN |
| **3** | NetworkPolicy | R-A3, R-D3 | `kubectl get networkpolicy` ≥1; data-tier deny egress |
| **4** | Postgres TLS + non-root везде | R-D1, R-D2, R-B2 | `SHOW ssl=on`; `DATABASE_URL` verify-full; rabbitmq securityContext |
| **5** | Prod profile app | R-B4 | readiness `/health`; `/docs` недоступен снаружи |
| **6** | Секреты и RBAC | R-C2 | Runbook: кто создаёт Secret; RBAC без лишнего `get secrets` |
| **7** | CI инварианты | R-C3 | `check_k8s_pilot_security.py` на `kustomize build` |
| **8** | RabbitMQ AMQPS | R-E1, R-E2, R-E3 | Нет plaintext 5672 в Service; `amqps://` в worker |
| **9** | MinIO TLS + S3 verify | R-F1, R-F2 | TLS listener; backend без `cert_check=False` |
| **10** | IAM / 2FA smoke | R-G2, R-B1 | Keycloak stable; CONFIGURE_TOTP для контрольной роли |
| **11** | Пакет R-H4 | R-H4 | Заполненный чеклист + `kustomize build` + список digest + этот roadmap |
| **12** | Upload план ИБ | R-J2 | `docs/security/security-upload-k8s-pilot.md` согласован |

После каждого шага: обновить колонку «Пилот K8s» в `docs/security-sb-checklist.md`, строку в `SECURITY-SB-R-MAPPING.md`, checkpoint в `STATE.md`.

**Текущий фокус:** **Шаг 3** — NetworkPolicy (R-A3, R-D3); шаг 2 **PASS** (2026-06-08).

**Шаг 2 (2026-06-08):** Ingress `spec.tls` + FQDN `pilot.acom-offer-desk.ru`; `verify-k8s-pilot-sb-step2.sh` **7/7 PASS**; Flux git revision ещё `005a977` — TLS применён вручную, после `git push origin k8s-pilot-popos` reconcile `pilot-apps`.
