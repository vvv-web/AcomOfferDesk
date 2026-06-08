#!/usr/bin/env python3
"""Static security gate for AcomOfferDesk K8s pilot manifests (kustomize render)."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


WEAK_LITERALS = (
    "guest/guest",
    "admin/admin",
    "amqp://guest:guest",
    "minioadmin",
    "password123",
)


def fail(message: str) -> None:
    print(f"::error::{message}", file=sys.stderr)
    raise SystemExit(1)


def kustomize_build(path: Path) -> str:
    try:
        proc = subprocess.run(
            ["kubectl", "kustomize", str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        fail("kubectl not found; install kubectl with kustomize")
    except subprocess.CalledProcessError as exc:
        fail(f"kustomize build failed for {path}: {exc.stderr.strip() or exc}")
    return proc.stdout


def check_weak_literals(text: str, *, label: str) -> None:
    lower = text.lower()
    for token in WEAK_LITERALS:
        if token in lower:
            fail(f"{label}: forbidden weak literal {token!r}")


def check_step7(pilot_dir: Path, root_text: str) -> None:
    check_weak_literals(root_text, label="kustomize pilot root")

    example = pilot_dir / "config" / "secrets.example.yaml"
    if example.is_file():
        ex = example.read_text(encoding="utf-8")
        check_weak_literals(ex, label="secrets.example.yaml")
        if "CHANGE_ME" not in ex:
            fail("secrets.example.yaml must use CHANGE_ME placeholders")

    if "APP_ENV" not in root_text or "production" not in root_text:
        fail("backend must set APP_ENV=production in pilot kustomize")
    if "loopback_users.guest = false" not in root_text:
        fail("rabbitmq-config must disable guest loopback user")


def check_step8(pilot_dir: Path, root_text: str, infra_text: str) -> None:
    combined = root_text + "\n" + infra_text
    if re.search(r"port:\s*5672", combined):
        fail("R-E2: must not expose plaintext AMQP port 5672")
    if "listeners.tcp = none" not in combined:
        fail("R-E2: rabbitmq.conf must set listeners.tcp = none")
    if "listeners.ssl.default = 5671" not in combined:
        fail("R-E2: rabbitmq.conf must enable TLS listener on 5671")

    example = pilot_dir / "config" / "secrets.example.yaml"
    if example.is_file():
        ex = example.read_text(encoding="utf-8")
        if "amqps://" not in ex and "CHANGE_ME_amqps" not in ex:
            fail("secrets.example must document amqps broker URL (R-E3)")

    apply = pilot_dir / "scripts" / "apply-pilot-secrets.sh"
    if apply.is_file():
        body = apply.read_text(encoding="utf-8")
        if "amqps://" not in body:
            fail("apply-pilot-secrets.sh must use amqps:// (R-E3)")
        if ":5672/" in body:
            fail("apply-pilot-secrets.sh must not use plaintext :5672 AMQP")


def check_step9(pilot_dir: Path, root_text: str, infra_text: str) -> None:
    combined = root_text + "\n" + infra_text
    if "minio-tls" not in combined:
        fail("R-F1: minio workload must mount secret minio-tls")
    if "runAsUser: 65532" not in combined:
        fail("R-F1: minio must run as UID 65532")

    apply = pilot_dir / "scripts" / "apply-pilot-secrets.sh"
    if apply.is_file():
        body = apply.read_text(encoding="utf-8")
        if 'S3_SECURE="false"' in body:
            fail("apply-pilot-secrets.sh must set S3_SECURE=true when MinIO TLS enabled")


def main() -> None:
    parser = argparse.ArgumentParser(description="K8s pilot security gate (SB steps 7–9+)")
    parser.add_argument("--pilot-dir", type=Path, default=Path("deploy/k8s/pilot"))
    parser.add_argument("--through-step", type=int, default=7, choices=(7, 8, 9, 11))
    args = parser.parse_args()
    pilot_dir = args.pilot_dir.resolve()
    if not pilot_dir.is_dir():
        fail(f"pilot dir not found: {pilot_dir}")

    root_text = kustomize_build(pilot_dir)
    infra_text = ""
    infra = pilot_dir / "flux-phases" / "infra"
    if infra.is_dir():
        infra_text = kustomize_build(infra)

    check_step7(pilot_dir, root_text)
    if args.through_step >= 8:
        check_step8(pilot_dir, root_text, infra_text)
    if args.through_step >= 9:
        check_step9(pilot_dir, root_text, infra_text)

    print(f"OK: k8s pilot security checks through step {args.through_step}")


if __name__ == "__main__":
    main()
