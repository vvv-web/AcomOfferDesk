from __future__ import annotations

import os
import ssl
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

_LIBPQ_QUERY_KEYS = frozenset(
    {
        "sslmode",
        "sslrootcert",
        "sslcert",
        "sslkey",
        "sslcrl",
        "sslcompression",
    }
)


def _ssl_mode_from_env() -> str | None:
    for key in ("PGSSLMODE", "sslmode"):
        raw = os.environ.get(key, "").strip().lower()
        if raw:
            return raw
    return None


def _ssl_root_cert_from_env() -> str | None:
    for key in ("PGSSLROOTCERT", "sslrootcert"):
        raw = os.environ.get(key, "").strip()
        if raw:
            return raw
    return None


def _asyncpg_ssl_connect_arg(mode: str, root_cert: str | None) -> Any:
    normalized = (mode or "").strip().lower()
    if normalized in {"", "disable", "allow"}:
        return False
    if normalized in {"prefer", "require"}:
        return True
    if normalized in {"verify-ca", "verify-full"}:
        cafile = root_cert or _ssl_root_cert_from_env()
        if not cafile:
            return True
        ctx = ssl.create_default_context(cafile=cafile)
        ctx.verify_mode = ssl.CERT_REQUIRED
        ctx.check_hostname = normalized == "verify-full"
        return ctx
    return True


def prepare_asyncpg_database_url(database_url: str) -> tuple[str, dict[str, Any]]:
    """Strip libpq query params from SQLAlchemy URL; map them to asyncpg connect_args."""
    raw = database_url.strip()
    parts = urlsplit(raw)
    if not parts.scheme:
        return raw, {}

    query_pairs = parse_qsl(parts.query, keep_blank_values=True)
    ssl_params: dict[str, str] = {}
    filtered: list[tuple[str, str]] = []
    for key, value in query_pairs:
        lowered = key.lower()
        if lowered in _LIBPQ_QUERY_KEYS:
            ssl_params[lowered] = value
        else:
            filtered.append((key, value))

    cleaned = urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(filtered),
            parts.fragment,
        )
    )

    mode = ssl_params.get("sslmode") or _ssl_mode_from_env()
    root_cert = ssl_params.get("sslrootcert") or _ssl_root_cert_from_env()
    if not mode and not root_cert:
        return cleaned, {}

    ssl_arg = _asyncpg_ssl_connect_arg(mode or "require", root_cert)
    if ssl_arg is False:
        return cleaned, {}
    return cleaned, {"ssl": ssl_arg}
