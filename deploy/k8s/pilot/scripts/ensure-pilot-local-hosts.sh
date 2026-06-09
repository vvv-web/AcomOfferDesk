#!/usr/bin/env bash
# Idempotent: ensure pilot.acom-offer-desk.ru → 127.0.0.1 in /etc/hosts for local k3s learn.
set -euo pipefail

FQDN="pilot.acom-offer-desk.ru"
IP="127.0.0.1"
HOSTS_FILE="/etc/hosts"
MARKER="# acom-k8s-pilot-local"
DESIRED_LINE="${IP} ${FQDN} ${MARKER}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--apply|--dry-run]

Wildcard DNS points ${FQDN} at VPS (155.212.160.162). On pop-os with local k3s,
add ${IP} ${FQDN} to ${HOSTS_FILE} so the browser hits Ingress on this machine.

  --apply    Append line if missing (uses sudo when needed)
  --dry-run  Only check; never write (default if --apply omitted and entry missing)
EOF
}

mode="check"
if [[ $# -eq 0 ]]; then
  :
else
  for arg in "$@"; do
    case "$arg" in
      --apply) mode="apply" ;;
      --dry-run) mode="dry-run" ;;
      -h|--help) usage; exit 0 ;;
      *) echo "Unknown arg: $arg" >&2; usage >&2; exit 2 ;;
    esac
  done
fi

if grep -qE "[[:space:]]${FQDN}([[:space:]]|$)" "$HOSTS_FILE" 2>/dev/null; then
  echo "OK: ${FQDN} already in ${HOSTS_FILE}:"
  grep -E "${FQDN}" "$HOSTS_FILE" || true
  exit 0
fi

echo "MISSING: ${FQDN} not in ${HOSTS_FILE}" >&2
echo "Without it, HTTPS opens prod/VPS nginx, not local pilot Ingress." >&2
echo >&2
echo "Manual fix (copy-paste):" >&2
echo "  echo '${DESIRED_LINE}' | sudo tee -a ${HOSTS_FILE}" >&2

if [[ "$mode" == "dry-run" ]]; then
  echo "Re-run with --apply to append when sudo is available." >&2
  exit 1
fi

if [[ "$mode" == "check" ]]; then
  if sudo -n true 2>/dev/null; then
    mode="apply"
  else
    echo "Passwordless sudo not available; use the tee command above." >&2
    exit 1
  fi
fi

if [[ "$mode" == "apply" ]]; then
  if ! sudo -n true 2>/dev/null; then
    echo "sudo required. Run:" >&2
    echo "  echo '${DESIRED_LINE}' | sudo tee -a ${HOSTS_FILE}" >&2
    exit 1
  fi
  echo "${DESIRED_LINE}" | sudo tee -a "$HOSTS_FILE" >/dev/null
  echo "OK: appended to ${HOSTS_FILE}"
  grep -E "${FQDN}" "$HOSTS_FILE" || true
fi
