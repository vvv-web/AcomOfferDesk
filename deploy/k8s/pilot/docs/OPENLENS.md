# OpenLens — просмотр пилота AcomOfferDesk в k3s (pop-os)

Краткая инструкция для GUI-наблюдения за namespace **`acom-offer-desk-pilot`** без секретов в документе.

## Важно: «Metrics not available» в OpenLens

### 1. Кластер может быть исправен, а Lens — нет

Проверка в терминале (источник правды):

```bash
kubectl get apiservice v1beta1.metrics.k8s.io   # AVAILABLE True
kubectl top nodes
kubectl top pods -n acom-offer-desk-pilot
```

Если команды выше **без ошибки** — **metrics-server работает**. Сообщение в OpenLens часто **не баг k3s**, а ограничение **OpenLens OSS 6.5.x**: UI ожидает **Prometheus**, а не только [metrics-server](https://github.com/kubernetes-sigs/metrics-server). См. [lensapp/lens#8095](https://github.com/lensapp/lens/issues/8095) (в коммерческом Lens metrics-server поддерживается; в OpenLens — нет).

### 2. Pod в статусе Succeeded / Failed — графиков не будет

**Jobs** (`flyway-migrate`, `keycloak-bootstrap` и т.д.) после завершения показывают **Succeeded** или **Failed**. Вкладки CPU/Memory в Lens для таких pod **пустые** даже при рабочем metrics-server — снимаются только **Running** workload’ы.

Для метрик откройте, например: **Deployments → `backend` → Pod → Running**.

### 3. Альтернатива с метриками: Headlamp (уже в кластере)

```bash
kubectl -n headlamp port-forward svc/headlamp 18090:80
```

Браузер: http://127.0.0.1:18090 → namespace **`acom-offer-desk-pilot`**.

### 4. Графики в OpenLens — Prometheus (установлен на pop-os)

OpenLens OSS **не рисует** графики только от metrics-server. На pop-os установлен минимальный **kube-prometheus-stack** (namespace **`monitoring`**).

**URL для OpenLens** (настройки кластера → Prometheus):

```text
http://kube-prometheus-kube-prome-prometheus.monitoring.svc:9090
```

**Шаги в OpenLens 6.5:**

1. Выберите кластер **default** → иконка **шестерёнки** (Cluster Settings) или **Settings**.
2. Раздел **Prometheus** / **Metrics**.
3. Укажите URL выше (или **Service**: `kube-prometheus-kube-prome-prometheus`, namespace `monitoring`, port `9090`).
4. **Save** → перезапустите OpenLens или **Disconnect / Reconnect** кластер.
5. Откройте **Running** pod (например `backend`), не **Succeeded** Job.

**Проверка в терминале:**

```bash
kubectl -n monitoring get pods
kubectl -n monitoring port-forward svc/kube-prometheus-kube-prome-prometheus 9090:9090
curl -sf http://127.0.0.1:9090/-/healthy
```

**Переустановка** (из корня репо):

```bash
./deploy/k8s/pilot/scripts/install-prometheus-openlens.sh
```

Values: `deploy/k8s/pilot/monitoring/helm-values-kube-prometheus-minimal.yaml` (Grafana/Alertmanager выкл., node-exporter выкл. — порт 9100 занят на хосте).

Другие варианты: платный **Lens** (metrics-server), [Freelens](https://github.com/freelensapp/freelens).

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
