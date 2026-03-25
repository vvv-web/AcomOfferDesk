from __future__ import annotations

from fastapi import Depends, Header

from app.core.session_tokens import decode_access_token
from app.core.uow import UnitOfWork
from app.domain.auth_context import build_current_user
from app.domain.exceptions import Unauthorized
from app.domain.policies import CurrentUser, UserPolicy
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
    claims = await decode_access_token(token)

    async with uow:
        repo = UserRepository(uow.session)
        user = await repo.get_by_id(claims.subject)
        if not user:
            raise Unauthorized("Invalid credentials")
        UserPolicy.can_login(user.status)
        return build_current_user(user_id=user.id, role_id=user.id_role, status=user.status)
