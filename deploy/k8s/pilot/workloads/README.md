# Workloads — Deployments

| Файл | Сервис | PVC | Probes |
|------|--------|-----|--------|
| `keycloak.yaml.example` | Keycloak 26.x | да | `/health/ready` management |
| `backend.yaml.example` | API | нет | **`/health`** (R-B4) |
| `web.yaml.example` | SPA/nginx | нет | static |
| `notifications-worker.yaml.example` | Celery worker | нет | process |
| `rabbitmq.yaml.example` | RabbitMQ | опц. | ping; AMQPS R-E2 |
| `minio.yaml.example` | MinIO | да | `/minio/health/ready`; UID 65532 |

Порядок rollout после Jobs — см. `../jobs/README.md`.

Gateway в compose заменяется **Ingress** (`../networking/ingress.yaml.example`).
