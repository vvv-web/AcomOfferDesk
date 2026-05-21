"""Write uppercase process env to a file for app.scripts.* --env-file (K8s Jobs)."""
from __future__ import annotations

import os
import sys

SKIP = {
    "PATH",
    "HOME",
    "HOSTNAME",
    "TERM",
    "SHLVL",
    "PWD",
    "PYTHONPATH",
    "KUBERNETES_SERVICE_HOST",
    "KUBERNETES_SERVICE_PORT",
}


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/pilot.env"
    with open(path, "w", encoding="utf-8") as handle:
        for key, value in sorted(os.environ.items()):
            if key in SKIP or key.startswith("_") or not key.isupper():
                continue
            handle.write(f"{key}={value.replace(chr(10), '')}\n")
    print(f"pilot-env: wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
