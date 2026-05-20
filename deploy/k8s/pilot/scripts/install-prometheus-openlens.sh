#!/usr/bin/env bash
# Минимальный Prometheus для графиков OpenLens OSS (namespace monitoring).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALUES="${ROOT}/monitoring/helm-values-kube-prometheus-minimal.yaml"
NS="${PROMETHEUS_NAMESPACE:-monitoring}"
RELEASE="${PROMETHEUS_RELEASE:-kube-prometheus}"

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo update prometheus-community

helm upgrade --install "${RELEASE}" prometheus-community/kube-prometheus-stack \
  --namespace "${NS}" \
  --create-namespace \
  -f "${VALUES}"

echo ""
echo "Ожидание Prometheus..."
kubectl -n "${NS}" rollout status statefulset/prometheus-kube-prometheus-kube-prome-prometheus --timeout=300s

SVC="${RELEASE}-kube-prome-prometheus"
echo ""
echo "Prometheus URL для OpenLens:"
echo "  http://${SVC}.${NS}.svc:9090"
echo ""
echo "Проверка:"
echo "  kubectl -n ${NS} port-forward svc/${SVC} 9090:9090"
echo "  curl -sf http://127.0.0.1:9090/-/healthy"
