# Networking

| Файл | Назначение | СБ |
|------|------------|-----|
| `ingress.yaml.example` | `/` → web, `/api` → backend, `/iam` → keycloak | R-A2, R-G1 |
| `networkpolicy.yaml.example` | tier edge/app/data, deny лишний egress | R-A3 |

Только **Ingress** публикуется наружу; Services — **ClusterIP** (R-A1).
