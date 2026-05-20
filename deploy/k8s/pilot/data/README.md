# Data tier — Postgres пилота

Фаза 1: **только** in-cluster Postgres для learn (§5.B4, §6 фаза 1).

| Файл | СБ |
|------|-----|
| `postgres-statefulset.yaml.example` | R-D1 TLS, R-D2 verify-full, R-D3 изоляция |

Flyway Job — `../jobs/flyway-migrate.job.yaml.example`.

VPS `order-database-postgres` — **не** подключается на этапе пилота.
