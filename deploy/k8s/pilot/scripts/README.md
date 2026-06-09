# Scripts — пилот K8s

| Скрипт | Назначение |
|--------|------------|
| `build-images.sh.example` | Сборка и push backend/web/worker @ `AOD_DEPLOY_SHA` |
| `ensure-pilot-local-hosts.sh` | Локальный FQDN → 127.0.0.1 в `/etc/hosts` (см. `docs/K3S_HOST_NETWORKING.md`) |
| `pre-apply-check.sh.example` | Сверка `upstream/test`, вывод SHA |

Скопировать без `.example`, сделать `chmod +x`. Секреты в скрипты **не** вставлять.
