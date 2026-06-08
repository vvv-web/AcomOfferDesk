# План upload в K8s-пилоте (R-J2)

**Статус:** учебный пилот `acom-offer-desk-pilot` — **не prod VPS**.

## Политика до закрытия §8.2

- Upload в MinIO/S3 — **только** через API backend с auth (Keycloak JWT).
- Публичного anonymous upload **нет**.
- Размер — `MAX_UPLOAD_SIZE_BYTES` в Secret/ConfigMap пилота.

## Перед включением upload в prod K8s

1. Согласование с ИБ (таблица R-J2 в `security-board-requirements`).
2. NetworkPolicy: ingress только `app` → `data` (уже в пилоте).
3. MinIO **TLS** + `S3_SECURE=true` + `S3_CA_CERT_PATH` (шаг 9).
4. Антивирус/скан — **вне scope** пилота; зафиксировать в СЗ.

## Проверка

- `verify-k8s-pilot-sb-step9.sh` — MinIO TLS
- Post-deploy: `post-deploy-verify-k8s.sh` — S3 smoke с CA

Канон чеклиста: `docs/security-sb-checklist.md`
