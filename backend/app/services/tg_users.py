from __future__ import annotations

from app.models.orm_models import TgUser
from app.repositories.tg_users import TgUserRepository


class TgUserRegistrationService:
    def __init__(self, tg_users: TgUserRepository):
        self._tg_users = tg_users

    async def register(self, tg_id: int) -> TgUser:
        existing = await self._tg_users.get_by_id(tg_id)
        if existing:
            return existing
        tg_user = TgUser(id=tg_id, status="review")
        await self._tg_users.add(tg_user)
        return tg_user