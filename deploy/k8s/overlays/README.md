# Overlays — будущий prod

Заготовка для production overlay после:

- зелёного **§8.1a** (функциональный пилот);
- **§8.2** (полный чеклист СБ);
- решения ИБ по cutover.

Планируемая структура:

```text
overlays/
  prod/
    kustomization.yaml    # bases: ../pilot + patches (digest, FQDN, replicas)
  staging/                # опционально: parity с VPS без prod data
```

Пока использовать только **`../pilot/`** для learn.
