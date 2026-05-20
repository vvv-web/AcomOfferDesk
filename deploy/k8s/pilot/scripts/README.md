# Scripts — пилот K8s

| Скрипт | Назначение |
|--------|------------|
| `build-images.sh.example` | Сборка и push backend/web/worker @ `AOD_DEPLOY_SHA` |
| `pre-apply-check.sh.example` | Сверка `upstream/test`, вывод SHA |

Скопировать без `.example`, сделать `chmod +x`. Секреты в скрипты **не** вставлять.
