from __future__ import annotations

import ssl
from types import SimpleNamespace

from app.infrastructure.postgres_asyncpg import prepare_asyncpg_database_url


def test_strips_sslmode_from_url_and_builds_ssl_context(monkeypatch) -> None:
    fake_ctx = SimpleNamespace(verify_mode=ssl.CERT_REQUIRED, check_hostname=True)

    def _fake_create_default_context(*, cafile):  # noqa: ARG001
        return fake_ctx

    monkeypatch.setattr(
        "app.infrastructure.postgres_asyncpg.ssl.create_default_context",
        _fake_create_default_context,
    )
    raw = (
        "postgresql+asyncpg://u:p@postgres:5432/order_database"
        "?sslmode=verify-full&sslrootcert=/etc/ssl/postgres/ca.crt"
    )
    url, connect_args = prepare_asyncpg_database_url(raw)
    assert url == "postgresql+asyncpg://u:p@postgres:5432/order_database"
    assert connect_args == {"ssl": fake_ctx}


def test_plain_url_without_ssl_params() -> None:
    raw = "postgresql+asyncpg://u:p@localhost:5432/test_db"
    url, connect_args = prepare_asyncpg_database_url(raw)
    assert url == raw
    assert connect_args == {}
