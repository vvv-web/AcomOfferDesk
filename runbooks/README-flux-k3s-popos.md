# Flux CD — AcomOfferDesk pilot (k3s pop-os)

**Scope:** только namespace `acom-offer-desk-pilot`, ветка **`k8s-pilot-popos`**, репо **`vvv-web/AcomOfferDesk`**. VPS prod и ветка `test` не трогаем (R-H1).

## Структура (monorepo)

- `clusters/k3s-popos/` — Flux `GitRepository` + цепочка `Kustomization`
- `deploy/k8s/pilot/flux-phases/` — поэтапный kustomize (DAG Jobs)
- Оф. гайд: [repository structure](https://fluxcd.io/flux/guides/repository-structure/)

## Предусловия

```bash
flux check
kubectl config current-context   # default, k3s pop-os
kubectl get ns acom-offer-desk-pilot flux-system
./deploy/k8s/pilot/scripts/apply-pilot-secrets.sh   # секреты не в git
```

## 1. Push ветки (обязательно)

Flux читает **remote** `k8s-pilot-popos`:

```bash
git push origin k8s-pilot-popos
```

Приватный репо: deploy key в `flux-system` + в `GitRepository` указать `secretRef` и `ssh://git@github.com/vvv-web/AcomOfferDesk.git`.

## 2. Установить Flux CR (без bootstrap всего репо)

Контроллеры уже в кластере (`flux-system`). Только CR пилота:

```bash
kubectl apply -k clusters/k3s-popos
```

## 3. Reconcile

```bash
flux get sources git -n flux-system
flux get kustomizations -n flux-system

flux reconcile source git acomofferdesk -n flux-system
flux reconcile kustomization pilot-base -n flux-system --with-source
# … по цепочке или сразу:
flux reconcile kustomization pilot-jobs-post -n flux-system --with-source
```

## 4. Проверка

```bash
kubectl get pods,jobs -n acom-offer-desk-pilot
flux get kustomizations -n flux-system
```

## Post-Jobs (K8s, не docker)

Jobs `keycloak-init-deploy` и `post-deploy-verify` **не** вызывают `scripts/*.sh` с VPS/docker.

- ConfigMap `pilot-job-scripts` (фаза `pilot-base`): `deploy/k8s/pilot/scripts/*-k8s.sh`
- Ingress: path `/health` → `backend:8000`, smoke через `curl -H "Host: aod-pilot.local"` к `ingress-nginx-controller.ingress-nginx.svc.cluster.local`
- Keycloak: `python -m app.scripts.check_keycloak_permission_model` (+ `--repair` при необходимости)

После правок манифестов:

```bash
./deploy/k8s/pilot/flux-phases/sync-hardlinks.sh
git push origin k8s-pilot-popos
kubectl delete job keycloak-init-deploy post-deploy-verify -n acom-offer-desk-pilot --ignore-not-found
flux reconcile kustomization pilot-jobs-post -n flux-system --with-source
```

Prometheus для Lens: `http://kube-prometheus-kube-prome-prometheus.monitoring.svc:9090` (см. `deploy/k8s/pilot/docs/OPENLENS.md`).

## Suspend (учебный контур)

```bash
flux suspend kustomization pilot-apps -n flux-system
flux resume kustomization pilot-apps -n flux-system
```

## Откат

```bash
flux suspend kustomization pilot-jobs-post -n flux-system
kubectl delete -k clusters/k3s-popos
```
