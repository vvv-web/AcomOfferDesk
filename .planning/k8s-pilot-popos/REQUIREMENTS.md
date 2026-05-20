# K8s pilot (pop-os) — требования

**Контур:** learn-кластер k3s на pop-os, namespace `acom-offer-desk-pilot`.  
**Источник кода:** только ветка **`test`**, паритет с `upstream/test` (`0 0`) перед сборкой образов.

## Обязательно

- **Изолированная БД:** in-cluster Postgres пилота (или отдельный тестовый инстанс). **Не** подключать K8s к prod Postgres на VPS.
- **Без изменений VPS prod:** `/opt/acome-offer-desk`, `/opt/order_database` не трогать.
- **AOD_DEPLOY_SHA:** фиксировать на каждом этапе сборки/apply; образы и Jobs — с того же SHA, что `upstream/test`.
- **Два уровня DoD (roadmap v0.5):** сначала функциональный пилот (**§8.1a**), затем SB (**§8.2**). Login ≠ закрытие чеклиста СБ.

## Запрещено на пилоте (без согласованного отклонения ИБ)

- `:latest` в overlay pilot после hardening
- Публичный `/docs` как readiness (**R-B4** → `/health`)
- Plaintext AMQP, TLS off на Postgres, секреты в git

## Ссылки

- [kubernetes-migration-roadmap.md](../../docs/operations/kubernetes-migration-roadmap.md) v0.5
- [deploy/k8s/pilot/README.md](../../deploy/k8s/pilot/README.md)
- Канон СБ: [security-board-requirements](https://github.com/vvv-web/security-board-requirements)
