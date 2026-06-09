#!/usr/bin/env bash
# Hardlinks манифестов в flux-phases/* (kustomize load restrictor).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PHASES="$(cd "$(dirname "$0")" && pwd)"

link() {
  local phase="$1"
  shift
  local dir="${PHASES}/${phase}/resources"
  rm -rf "${dir}"
  mkdir -p "${dir}"
  for rel in "$@"; do
    local src="${ROOT}/${rel}"
    local base
    base="$(basename "${rel}")"
    mkdir -p "${dir}/$(dirname "${rel}")"
    ln -f "${src}" "${dir}/${rel}"
  done
}

link base \
  namespace.yaml \
  rbac/secrets-rbac.yaml \
  config/rabbitmq-configmap.yaml

link infra \
  data/postgres-statefulset.yaml \
  workloads/rabbitmq.yaml \
  workloads/minio.yaml \
  workloads/keycloak.yaml

link jobs-migrate \
  jobs/flyway-migrate.job.yaml \
  jobs/postgres-init-schema.job.yaml

link jobs-bootstrap \
  jobs/keycloak-db-prepare.job.yaml \
  jobs/keycloak-bootstrap.job.yaml

link apps \
  workloads/backend.yaml \
  workloads/web.yaml \
  workloads/notifications-worker.yaml \
  networking/ingress.yaml \
  networking/networkpolicy.yaml

link jobs-post \
  jobs/keycloak-user-role-sync.job.yaml \
  jobs/keycloak-init-deploy.job.yaml \
  jobs/post-deploy-verify.job.yaml

echo "OK: hardlinks under flux-phases/*/resources/"
