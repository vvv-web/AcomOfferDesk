# OpenLens — просмотр пилота AcomOfferDesk в k3s (pop-os)

Краткая инструкция для GUI-наблюдения за namespace **`acom-offer-desk-pilot`** без секретов в документе.

## Установка (Linux, Pop!_OS)

Рекомендуемый способ — **AppImage** из [MuhammedKalkan/OpenLens](https://github.com/MuhammedKalkan/OpenLens/releases):

```bash
mkdir -p ~/Applications
curl -fsSL -o ~/Applications/OpenLens.AppImage \
  "https://github.com/MuhammedKalkan/OpenLens/releases/download/v6.5.2-366/OpenLens-6.5.2-366.x86_64.AppImage"
chmod +x ~/Applications/OpenLens.AppImage
```

Запуск:

```bash
~/Applications/OpenLens.AppImage
```

Альтернатива: скопировать AppImage на `~/Desktop/OpenLens.AppImage` и запускать оттуда.

**Flatpak:** официального пакета OpenLens в Flathub нет; для этого пилота используйте AppImage.

## kubeconfig

OpenLens читает стандартный файл:

| Параметр | Ожидаемое значение |
|----------|-------------------|
| Файл | `~/.kube/config` |
| Контекст | `default` (k3s на pop-os) |
| API server | `https://127.0.0.1:6443` |

Проверка в терминале:

```bash
kubectl config current-context
kubectl cluster-info
```

## Подключение кластера в OpenLens

1. Запустите AppImage (`~/Applications/OpenLens.AppImage`).
2. **Catalog** (или **+ Add Cluster**) → **Add from kubeconfig**.
3. Укажите путь: `~/.kube/config` (или выберите файл через диалог).
4. Выберите контекст **`default`** → **Add Cluster**.
5. В левой панели откройте кластер → **Workloads** → вверху выберите namespace **`acom-offer-desk-pilot`**.

Чтобы namespace был в списке по умолчанию: **Settings** кластера → **Namespace** → включить только `acom-offer-desk-pilot` (опционально).

## Что смотреть в пилоте

| Ресурс | Имя | На что обратить внимание |
|--------|-----|--------------------------|
| **Jobs** | `keycloak-bootstrap` | Статус **Complete** (долго, этап `enforce_atomic`). **Failed** → Logs → см. runbook ниже |
| **Jobs** | `flyway-migrate`, `keycloak-db-prepare`, `postgres-init-schema` | Должны быть **Complete** |
| **Jobs** | `keycloak-user-role-sync`, `post-deploy-verify` | Появятся после успешного bootstrap |
| **Deployments** | `backend`, `web`, `keycloak`, `rabbitmq`, `minio`, `notifications-worker` | **1/1 Ready** |
| **StatefulSet** | `postgres` | Pod `postgres-0` **Running** |
| **Ingress** | `acom-pilot` | Host `aod-pilot.local`, class `nginx`; ADDRESS может быть пустым до починки ingress-nginx |
| **Pods** | `notifications-worker` | Возможны предупреждения liveness (`pgrep` в образе) — не блокер health backend |

### Метрики CPU/RAM в Lens

Lens и `kubectl top` используют **Metrics API** (`metrics-server` в `kube-system`).

| Проверка | Ожидание |
|----------|----------|
| `kubectl get apiservice v1beta1.metrics.k8s.io` | **AVAILABLE True** |
| `kubectl top nodes` | таблица CPU/MEM без ошибки |

Если «Metrics not available» — чаще всего **node-ip** в k3s указывает на недоступный IP (например Tailscale peer). Runbook: **`deploy/k8s/pilot/docs/K3S_HOST_NETWORKING.md`**.

После починки: **Refresh** кластера в OpenLens.

### Как открыть Logs (если нет иконки)

1. **Workloads → Pods** → клик по pod → правая панель → **Logs** (или иконка терминала/логов).
2. ПКМ по pod → **Logs**.
3. **Workloads → Jobs** → `keycloak-bootstrap` → вкладка **Pods** → нужный pod → **Logs**.
4. CLI:

```bash
kubectl logs -n acom-offer-desk-pilot -l job-name=keycloak-bootstrap --tail=80
kubectl logs -n kube-system -l k8s-app=metrics-server --tail=30
```

У pod в статусе **Failed** метрик в Lens может не быть — смотрите **Logs** и **Events** (внизу drawer).

### Типичные проблемы (без значений секретов)

- **keycloak-bootstrap Failed** — открыть **Logs** job/pod; переприменить job из репо:  
  `kubectl apply -f deploy/k8s/pilot/jobs/keycloak-bootstrap.job.yaml`
- **Ingress 404** на `aod-pilot.local` — до фикса CoreDNS/ingress-nginx смотреть сервисы через **port-forward** (см. STATE.md).
- **Секреты placeholder** — пока нет локального `backend/.env`, в **Secrets** → `acom-app-secrets` будут учебные значения; не использовать для prod.
- **Metrics not available** — см. `K3S_HOST_NETWORKING.md` (node-ip / `systemctl restart k3s`).

## Доступ к UI без OpenLens

| Сервис | Способ |
|--------|--------|
| Backend `/health` | `kubectl port-forward -n acom-offer-desk-pilot svc/backend 8000:8000` → http://127.0.0.1:8000/health |
| Web | `kubectl port-forward -n acom-offer-desk-pilot svc/web 8080:80` |
| Ingress (если работает) | В `/etc/hosts`: `127.0.0.1 aod-pilot.local`, затем NodePort ingress-nginx или port-forward controller |

## Связанные файлы

- Состояние пилота: `.planning/k8s-pilot-popos/STATE.md`
- План шагов: `.planning/k8s-pilot-popos/PLAN.md`
- k3s node-ip / metrics-server: `deploy/k8s/pilot/docs/K3S_HOST_NETWORKING.md`
- Roadmap: `docs/operations/kubernetes-migration-roadmap.md`
