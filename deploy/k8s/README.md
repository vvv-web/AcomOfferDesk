# Kubernetes — каталог AcomOfferDesk

Канонический дом всех манифестов K8s для проекта **AcomOfferDesk**.

**Git (fork-only):** манифесты и скрипты пилота коммитятся только в форке **`vvv-web/AcomOfferDesk`**, ветка **`k8s-pilot-popos`**. Remote **`upstream`** (`alexonderia/AcomOfferDesk`) — read-only (`git fetch`); push только `git push origin k8s-pilot-popos`. Канонический репозиторий alexonderia и ветки `main`/`test` upstream **не меняем** из этого контура.

| Контур | Путь | Назначение |
|--------|------|------------|
| **Пилот (learn)** | `pilot/` | pop-os / k3s, изолированная БД, полный профиль СБ поэтапно |
| **Prod (будущее)** | `overlays/` | overlay после зелёного пилота и cutover |

## Дорожная карта

- [kubernetes-migration-roadmap.md](../../docs/operations/kubernetes-migration-roadmap.md) (v0.5, PIVOT консилиум 2026-05-19)
- Чеклист СБ: [docs/security-sb-checklist.md](../../docs/security-sb-checklist.md)

## Файлы `.example`

Шаблоны с плейсхолдерами (`CHANGE_ME`, `${REGISTRY}`) **без секретов**. Перед apply:

1. Скопировать `*.yaml.example` → `*.yaml` (без суффикса `.example`) **или** использовать Kustomize patches.
2. Создать Secret на кластере из `pilot/config/secrets.example.yaml` (только ключи в git).
3. Зафиксировать **`AOD_DEPLOY_SHA`** (`git rev-parse upstream/test`) — см. `pilot/scripts/pre-apply-check.sh.example`.

## Порядок первого подъёма

1. `pilot/scripts/pre-apply-check.sh` (после копирования без `.example`)
2. `pilot/scripts/build-images.sh` → push digest
3. `kubectl apply -k deploy/k8s/pilot` (после заполнения секретов)
4. Jobs по DAG в `pilot/jobs/README.md`

## Документация пилота (pop-os / k3s)

| Документ | Содержание |
|----------|------------|
| [pilot/docs/OPENLENS.md](pilot/docs/OPENLENS.md) | GUI, метрики, Logs, namespace `acom-offer-desk-pilot` |
| [pilot/docs/K3S_HOST_NETWORKING.md](pilot/docs/K3S_HOST_NETWORKING.md) | node-ip, metrics-server, CoreDNS (инцидент 2026-05-20) |
| [pilot/docs/OPENLENS.md](pilot/docs/OPENLENS.md) + Prometheus URL | Графики CPU/Memory в OpenLens OSS |
| [.planning/k8s-pilot-popos/STATE.md](../../.planning/k8s-pilot-popos/STATE.md) | Статус шагов 0–12, blockers, git policy |
