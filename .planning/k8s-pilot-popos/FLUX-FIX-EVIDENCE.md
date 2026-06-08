# FLUX-FIX-EVIDENCE — 2026-06-08T14:06:15+03:00

## k3s (flap noted; one clean restart)
active
k3s_stop_count_30min=5

## Tailscale throw route (table 52)
throw 10.43.0.0/16 

## flux-system pods
NAME                                       READY   STATUS    RESTARTS         AGE   IP            NODE     NOMINATED NODE   READINESS GATES
helm-controller-5c9d849c4-mw5t4            1/1     Running   0                23m   10.42.0.202   pop-os   <none>           <none>
kustomize-controller-7b5df57d5d-jb9z8      1/1     Running   0                23m   10.42.0.203   pop-os   <none>           <none>
notification-controller-6f767cfd76-vpp27   1/1     Running   2336 (29m ago)   13d   10.42.0.135   pop-os   <none>           <none>
source-controller-78b8857c9c-rtjgp         1/1     Running   0                23m   10.42.0.204   pop-os   <none>           <none>

## git source
NAME            URL                                            AGE   READY   STATUS
acomofferdesk   https://github.com/vvv-web/AcomOfferDesk.git   17d   True    stored artifact for revision 'k8s-pilot-popos@sha1:26b64d1fc08ffa7e12bc0a9a0df70a7e48652132'

## pilot-* kustomizations
pilot-apps             17d   True    Applied revision: k8s-pilot-popos@sha1:26b64d1fc08ffa7e12bc0a9a0df70a7e48652132
pilot-base             17d   True    Applied revision: k8s-pilot-popos@sha1:26b64d1fc08ffa7e12bc0a9a0df70a7e48652132
pilot-infra            17d   True    Applied revision: k8s-pilot-popos@sha1:26b64d1fc08ffa7e12bc0a9a0df70a7e48652132
pilot-jobs-bootstrap   17d   True    Applied revision: k8s-pilot-popos@sha1:26b64d1fc08ffa7e12bc0a9a0df70a7e48652132
pilot-jobs-migrate     17d   True    Applied revision: k8s-pilot-popos@sha1:26b64d1fc08ffa7e12bc0a9a0df70a7e48652132
pilot-jobs-post        17d   True    Applied revision: k8s-pilot-popos@sha1:26b64d1fc08ffa7e12bc0a9a0df70a7e48652132

## flux reconcile (exit 0)
flux reconcile source git acomofferdesk -> 26b64d1fc08ffa7e12bc0a9a0df70a7e48652132
flux reconcile pilot-infra, pilot-jobs-migrate, pilot-jobs-bootstrap, pilot-jobs-post, pilot-apps -> applied same SHA

## fix notes
- hostNetwork flux-patch caused :8080/:9440 port conflicts; reverted to ClusterFirst after throw 10.43.0.0/16 OK
- metrics-addr patch attempted; final controllers on RS without hostNetwork

## 11. post-deploy-verify fix (2026-06-08T14:19:11+03:00)

KUBECONFIG=~/.kube/config

### 11.1 Root cause

| Симптом | Причина |
|---------|---------|
| OIDC `Hostname mismatch` для `pilot.acom-offer-desk.ru` | В pod FQDN резолвится на VPS `155.212.160.162` (prod cert), не на in-cluster Ingress |
| `app.*` composite mismatch | Nested `app.*` внутри `app.admin` и т.д. (pollution); лечится `keycloak-bootstrap` (`enforce_atomic_permission_roles` + `sync_composite_role`) |
| Job Failed при успешном repair | `set -e` + `check_keycloak_permission_model --repair` exit 1 до финальной проверки |

### 11.2 Fixes (git + cluster)

- `acom-pilot-tls` пересоздан: `generate-pilot-ingress-tls.sh` (SAN `pilot.acom-offer-desk.ru`)
- `post-deploy-verify-k8s.sh`: `--repair || true` перед повторной проверкой
- Job `keycloak-bootstrap` пересоздан: `flux reconcile kustomization pilot-jobs-bootstrap --with-source --timeout=20m` → **Complete** 1/1
- Job `post-deploy-verify` → **Complete** 1/1; лог: `POST_DEPLOY_VERIFY_K8S: all checks passed` (OIDC discovery — WARN self-signed, не блокер)

### 11.3 flux reconcile pilot-jobs-post

```
flux reconcile kustomization pilot-jobs-post -n flux-system --with-source --timeout=20m
```

После удаления Job и push коммита со скриптом — kustomization **Ready** (health Job Complete).

### 11.4 pilot-* status (after fix)

```
pilot-base,pilot-infra,pilot-apps,pilot-jobs-migrate,pilot-jobs-bootstrap,pilot-jobs-post -> Ready @ k8s-pilot-popos@sha1:26b64d1f (post-push)
```

