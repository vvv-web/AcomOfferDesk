from __future__ import annotations

from dataclasses import dataclass

from app.core.session_tokens import create_access_token, create_refresh_token
from app.core.security import verify_password
from app.domain.exceptions import Forbidden, NotFound, Unauthorized
from app.domain.policies import UserPolicy
from app.models.orm_models import User
from app.repositories.users import UserRepository


@dataclass(frozen=True, slots=True)
class AuthSessionBundle:
    user_id: str
    login: str
    role_id: int
    status: str
    access_token: str
    access_token_expires_at: int
    refresh_token: str
    refresh_token_expires_at: int
    refresh_token_max_expires_at: int


class AuthSessionService:
    def __init__(self, users: UserRepository) -> None:
        self._users = users

    async def login(self, *, login: str, password: str) -> AuthSessionBundle:
        user = await self._users.get_by_id(login)
        if user is None:
            raise NotFound("User not found")
        if not await verify_password(password, user.password_hash):
            raise Forbidden("Invalid credentials")
        UserPolicy.can_login(user.status)
        return await self.build_session_bundle(user=user)

    async def build_session_bundle(
        self,
        *,
        user: User,
        refresh_max_expires_at: int | None = None,
    ) -> AuthSessionBundle:
        UserPolicy.can_login(user.status)
        access_token, access_token_expires_at = await create_access_token(user_id=user.id)
        refresh_token, refresh_token_expires_at, refresh_token_max_expires_at = await create_refresh_token(
            user_id=user.id,
            password_hash=user.password_hash,
            max_expires_at=refresh_max_expires_at,
        )
        return AuthSessionBundle(
            user_id=user.id,
            login=user.id,
            role_id=user.id_role,
            status=user.status,
            access_token=access_token,
            access_token_expires_at=access_token_expires_at,
            refresh_token=refresh_token,
            refresh_token_expires_at=refresh_token_expires_at,
            refresh_token_max_expires_at=refresh_token_max_expires_at,
        )

    async def get_user_for_refresh(self, *, user_id: str) -> User:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise Unauthorized("Invalid credentials")
        UserPolicy.can_login(user.status)
        return user
