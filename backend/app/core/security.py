from __future__ import annotations

from datetime import datetime, timedelta, timezone

import anyio
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

_password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def hash_password(password: str) -> str:
    return await anyio.to_thread.run_sync(_password_context.hash, password)


async def verify_password(password: str, password_hash: str) -> bool:
    return await anyio.to_thread.run_sync(_password_context.verify, password, password_hash)


async def create_access_token(subject: str, role_id: int) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_exp_minutes)
    payload = {
        "sub": subject,
        "role_id": role_id,
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def decode_access_token(token: str) -> dict[str, str | int]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
