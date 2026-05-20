#!/usr/bin/env bash
# Сборка образов пилота @ upstream/test SHA; импорт в k3s (без registry).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT"

export AOD_DEPLOY_SHA="${AOD_DEPLOY_SHA:-$(git rev-parse HEAD)}"
TAG="${AOD_DEPLOY_SHA:0:12}"
echo "AOD_DEPLOY_SHA=$AOD_DEPLOY_SHA TAG=$TAG"

BACKEND_IMG="acom-backend:${TAG}"
WEB_IMG="acom-web:${TAG}"
WORKER_IMG="acom-notifications-worker:${TAG}"

docker build -f backend/Dockerfile -t "${BACKEND_IMG}" .
docker build -t "${WEB_IMG}" ./web
docker build -f notifications_worker/Dockerfile -t "${WORKER_IMG}" .

import_one() {
  local img="$1"
  local tar="/tmp/k3s-import-$(echo "$img" | tr '/:' '_').tar"
  docker save "$img" -o "$tar"
  sudo k3s ctr images import "$tar" 2>/dev/null || sudo ctr -n k8s.io images import "$tar"
  rm -f "$tar"
  echo "imported: $img"
}

import_one "${BACKEND_IMG}"
import_one "${WEB_IMG}"
import_one "${WORKER_IMG}"

echo "PILOT_IMAGES:"
echo "  BACKEND=${BACKEND_IMG}"
echo "  WEB=${WEB_IMG}"
echo "  WORKER=${WORKER_IMG}"
echo "imagePullPolicy: Never in manifests"
