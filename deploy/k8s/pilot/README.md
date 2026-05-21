# Пилот K8s — AcomOfferDesk

Изолированный namespace на learn-кластере (например k3s на pop-os). **Не** подключается к prod Postgres на VPS.

## Предусловия

- `kubectl` + Ingress Controller (nginx)
- Ветка **`test`** синхронизирована с `upstream/test` (`0 0`)
- Registry для образов backend / web / notifications_worker
- TLS-сертификаты Postgres (генерация — по runbook проекта, аналог VPS)

## Переменная `AOD_DEPLOY_SHA`

```bash
cd ~/Desktop/acome-offer-desk/AcomOfferDesk
git fetch upstream test
git checkout test && git reset --hard upstream/test
export AOD_DEPLOY_SHA="$(git rev-parse HEAD)"
echo "Пилот: test @ $AOD_DEPLOY_SHA"
```

Используется в labels манифестов, Job bootstrap и при сборке образов.

## Flux GitOps (ветка `k8s-pilot-popos`)

```bash
./deploy/k8s/pilot/flux-phases/sync-hardlinks.sh   # после правок YAML в pilot/
git push origin k8s-pilot-popos
kubectl apply -k clusters/k3s-popos
flux reconcile kustomization pilot-jobs-post -n flux-system --with-source
```

См. [`docs/FLUX.md`](docs/FLUX.md), [`runbooks/README-flux-k3s-popos.md`](../../../runbooks/README-flux-k3s-popos.md).

## Apply (черновик)

```bash
# 1. Секреты — вручную, не в git (см. config/secrets.example.yaml)
kubectl create namespace acom-offer-desk-pilot --dry-run=client -o yaml | kubectl apply -f -

# 2. После копирования .example → рабочие файлы и kustomize:
kubectl apply -k deploy/k8s/pilot

# 3. Jobs по порядку — см. jobs/README.md
```

## Ingress пилота

Пример host: `aod-pilot.example.com` → `/etc/hosts` на 127.0.0.1 для learn.

Публичные URL в ConfigMap/Secret должны совпадать с Ingress (Keycloak **R-G1**).

## Связанные документы

- [kubernetes-migration-roadmap.md](../../../docs/operations/kubernetes-migration-roadmap.md) §5, §8.1a/8.2
- [security-sb-checklist.md](../../../docs/security-sb-checklist.md)
