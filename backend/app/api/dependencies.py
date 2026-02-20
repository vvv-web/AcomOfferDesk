from __future__ import annotations

from fastapi import Depends, Header
from jose import JWTError, ExpiredSignatureError

from app.core.uow import UnitOfWork
from app.domain.exceptions import Unauthorized
from app.domain.policies import CurrentUser
from app.core.security import decode_access_token
from app.repositories.users import UserRepository


async def get_uow() -> UnitOfWork:
    return UnitOfWork()


async def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    uow: UnitOfWork = Depends(get_uow),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise Unauthorized("Missing credentials")
    
    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = await decode_access_token(token)
    except ExpiredSignatureError as exc:
        raise Unauthorized("Token expired") from exc
    except JWTError as exc:
        raise Unauthorized("Invalid token") from exc
    
    user_id = str(payload.get("sub"))

    if not user_id:
        raise Unauthorized("Invalid token payload")
    
    async with uow:
        repo = UserRepository(uow.session)
        user = await repo.get_by_id(user_id)
        if not user:
            raise Unauthorized("Invalid credentials")
        return CurrentUser(user_id=user.id, role_id=user.id_role, status=user.status)