from __future__ import annotations

from app.core.security import create_access_token, verify_password
from app.domain.exceptions import Forbidden, NotFound
from app.domain.policies import UserPolicy
from app.repositories.users import UserRepository


class AuthService:
    def __init__(self, users: UserRepository):
        self._users = users

    async def login(self, login: str, password: str) -> tuple[str, int]:
        user = await self._users.get_by_id(login)
        if not user:
            raise NotFound("User not found")
        if not await verify_password(password, user.password_hash):
            raise Forbidden("Invalid credentials")
        UserPolicy.can_login(user.status)
        token = await create_access_token(subject=user.id, role_id=user.id_role)
        return token, user.id_role