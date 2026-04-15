from __future__ import annotations

from fastapi import Depends, Header

from app.core.uow import UnitOfWork
from app.domain.auth_context import CurrentUser, build_current_user
from app.domain.exceptions import Unauthorized
from app.services.identity_sync import IdentitySyncService
from app.services.keycloak_oidc import decode_keycloak_access_token, looks_like_keycloak_token


async def get_uow() -> UnitOfWork:
    return UnitOfWork()


async def _get_current_user_from_keycloak_token(token: str, *, uow: UnitOfWork) -> CurrentUser:
    claims = await decode_keycloak_access_token(token)
    sync_service = IdentitySyncService(
        users=uow.users,
        user_auth_accounts=uow.user_auth_accounts,
        user_contact_channels=uow.user_contact_channels,
        profiles=uow.profiles,
    )
    synced = await sync_service.sync_keycloak_identity(claims, allow_user_creation=False)
    return build_current_user(
        user_id=synced.user.id,
        role_id=synced.user.id_role,
        status=synced.user.status,
    )


async def get_current_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    uow: UnitOfWork = Depends(get_uow),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise Unauthorized("Missing credentials")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise Unauthorized("Missing credentials")

    async with uow:
        if not looks_like_keycloak_token(token):
            raise Unauthorized("Missing credentials")
        return await _get_current_user_from_keycloak_token(token, uow=uow)
