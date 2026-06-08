# Пакет R-H4 для ИБ — K8s pilot

**Ветка:** `k8s-pilot-popos` · **Namespace:** `acom-offer-desk-pilot`

## Состав

| Артефакт | Путь |
|----------|------|
| Чеклист R-* | `docs/security-sb-checklist.md` |
| Маппинг | `deploy/k8s/pilot/docs/SECURITY-SB-R-MAPPING.md` |
| SB шаги | `.planning/k8s-pilot-popos/SB-STEPS.md` |
| Verify | `deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step{2..12}.sh` |
| CI gate | `.github/scripts/check_k8s_pilot_security.py` |
| Roadmap §8.2 | `docs/operations/kubernetes-migration-roadmap.md` |

## Команды для ИБ (offline)

```bash
cd acom-offer-desk/AcomOfferDesk
kubectl kustomize deploy/k8s/pilot > /tmp/pilot-kustomize.yaml
python3 .github/scripts/check_k8s_pilot_security.py --through-step 9
for n in 7 8 9 10 11 12; do ./deploy/k8s/pilot/scripts/verify-k8s-pilot-sb-step${n}.sh; done
```

## Образы (learn, local import)

См. `deploy/k8s/pilot/scripts/build-images.sh` — тег = `git rev-parse HEAD` (12 hex).

**Prod VPS не затрагивался.**
