# k3s на pop-os — node-ip, API, metrics-server, CoreDNS

Документ фиксирует инцидент **2026-05-20**: pod’ы (CoreDNS, metrics-server) не достучались до API → `kubectl top` и метрики в OpenLens не работали.

## Симптомы

| Симптом | Проявление |
|---------|------------|
| `kubectl top nodes` | `Metrics API not available` |
| APIService `v1beta1.metrics.k8s.io` | `Available: False (MissingEndpoints)` |
| metrics-server | `CrashLoopBackOff`, panic: `dial tcp 10.43.0.1:443: i/o timeout` |
| CoreDNS | `0/1`, readiness 503, `Plugins not ready: kubernetes` |
| OpenLens | «Metrics not available at the moment» |
| Ingress / ClusterIP к API | таймаут на `kubernetes` Endpoints |

## Корневая причина

В **`/etc/rancher/k3s/config.yaml`** был задан:

```yaml
node-ip: 10.131.209.1
```

Адрес **`10.131.209.1`** — peer в **Tailscale** (`ip route get` → `dev tailscale0`), с хоста **не пингуется** и **не слушает** `:6443`. Kubernetes публиковал endpoint API как `10.131.209.1:6443`, а pod’ы ходили на ClusterIP `10.43.0.1` → DNAT на недоступный IP.

Актуальный LAN Wi‑Fi на pop-os: **`10.16.69.1`** (`wlp130s0f0`). API отвечает на `10.16.69.1:6443` и `10.42.0.1:6443` (cni0).

## Исправление (применено на pop-os)

1. Бэкап: `/etc/rancher/k3s/config.yaml.bak.<UTC>`
2. Заменить `node-ip` и `tls-san` на реальный LAN IP (не Tailscale peer):

```yaml
# pop-os single-node: node-ip must be reachable on the host (not a remote Tailscale peer IP).
node-ip: 10.16.69.1
tls-san:
  - "127.0.0.1"
  - "10.16.69.1"
  - "localhost"
```

3. Перезапуск:

```bash
sudo systemctl restart k3s
```

4. После Ready ноды:

```bash
kubectl rollout restart deployment/coredns -n kube-system
```

5. Проверка (DoD):

```bash
kubectl get apiservice v1beta1.metrics.k8s.io   # AVAILABLE True
kubectl top nodes
kubectl top pods -n acom-offer-desk-pilot
curl -sk --connect-timeout 3 https://10.16.69.1:6443/healthz   # 401 Unauthorized — OK
```

## metrics-server (k3s addon)

После починки API addon **k3s** поднимает metrics-server сам (Deployment в `kube-system`, label `k8s-app=metrics-server`). Типичные args уже включают `--kubelet-insecure-tls` на однонодовом k3s.

Не дублировать второй metrics-server вручную — один Deployment, `replicas: 1`.

## OpenLens

- После фикса node-ip: **`kubectl top`** и Metrics API **Available** — кластер в порядке.
- **OpenLens OSS** может всё равно писать «Metrics not available» — UI не использует metrics-server как коммерческий Lens ([issue #8095](https://github.com/lensapp/lens/issues/8095)); см. `OPENLENS.md` → Headlamp или `kubectl top`.
- Графики только у **Running** pod; у **Succeeded** Job (`flyway-migrate`) — пусто по дизайну.
- **Logs** у pod: Workloads → Pods → pod → **Logs**; для Job → Workloads → Jobs.

См. также: `deploy/k8s/pilot/docs/OPENLENS.md`.

## Если снова сломалось (смена Wi‑Fi / DHCP)

1. `kubectl get nodes -o wide` → взять **INTERNAL-IP**.
2. Обновить `node-ip` и `tls-san` в `/etc/rancher/k3s/config.yaml`.
3. `sudo systemctl restart k3s`
4. `kubectl rollout restart deployment/coredns -n kube-system`

**Не использовать** Tailscale peer IP (`10.131.x.x`) как `node-ip`, если API на нём локально не слушает.

## Связь с пилотом AcomOfferDesk

Починка **кластерная** (весь k3s), не только namespace `acom-offer-desk-pilot`. Без неё не работают CoreDNS, ingress-nginx sync к API и метрики в GUI.

Состояние пилота: `.planning/k8s-pilot-popos/STATE.md`.

## Локальный доступ pilot FQDN

`pilot.acom-offer-desk.ru` в публичном DNS (wildcard FirstVDS) указывает на **VPS** `155.212.160.162`. На **pop-os** с локальным k3s браузер без override откроет **prod/VPS**, а не Ingress пилота в кластере.

**Стабильная запись на учебной машине** — одна строка в `/etc/hosts` (нужен root, переживает перезагрузку):

```text
127.0.0.1 pilot.acom-offer-desk.ru  # acom-k8s-pilot-local
```

Скрипт (идемпотентный): `deploy/k8s/pilot/scripts/ensure-pilot-local-hosts.sh`

```bash
# проверка
./deploy/k8s/pilot/scripts/ensure-pilot-local-hosts.sh --dry-run
# добавить, если sudo без пароля (иначе скрипт печатает точную команду tee)
./deploy/k8s/pilot/scripts/ensure-pilot-local-hosts.sh --apply
```

Полная персистентность только через root (`/etc/hosts`); user-level systemd **не** заменяет hosts — после смены DHCP/Wi‑Fi сверяйте, что строка на месте.

См. также Graph RAG: `acom_k8s_pilot_local_hosts_dns_jun2026`, `acom_k8s_pilot_fqdn_pilot_subdomain_jun2026`.

## Оф. ссылки

- Resource metrics pipeline: https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/
- metrics-server install: https://github.com/kubernetes-sigs/metrics-server#installation
- k3s configuration: https://docs.k3s.io/installation/configuration
