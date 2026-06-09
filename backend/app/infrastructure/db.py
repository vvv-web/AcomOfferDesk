from __future__ import annotations

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.infrastructure.postgres_asyncpg import prepare_asyncpg_database_url

_db_url, _connect_args = prepare_asyncpg_database_url(settings.database_url)
engine = create_async_engine(
    _db_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
