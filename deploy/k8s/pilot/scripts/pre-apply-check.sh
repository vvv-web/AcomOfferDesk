#!/usr/bin/env bash
# Проверка перед kubectl apply пилота
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$REPO_ROOT"

git fetch upstream test
BEHIND="$(git rev-list --left-right --count HEAD...upstream/test | awk '{print $1}')"
AHEAD="$(git rev-list --left-right --count HEAD...upstream/test | awk '{print $2}')"

if [[ "$BEHIND" != "0" || "$AHEAD" != "0" ]]; then
  echo "WARN: ветка test не совпадает с upstream/test ($BEHIND behind, $AHEAD ahead)" >&2
  exit 1
fi

export AOD_DEPLOY_SHA="$(git rev-parse HEAD)"
echo "OK: test @ $AOD_DEPLOY_SHA"

if ! kubectl cluster-info >/dev/null 2>&1; then
  echo "FAIL: kubectl недоступен" >&2
  exit 1
fi

echo "OK: kubectl cluster-info"
