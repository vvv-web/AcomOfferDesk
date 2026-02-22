from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import TgUser


class TgUserRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, tg_id: int) -> TgUser | None:
        return await self._session.get(TgUser, tg_id)

    async def get_or_create(self, tg_id: int, *, default_status: str = "review") -> TgUser:
        """Возвращает tg_user, создаёт при отсутствии. Обрабатывает race (дубль при повторном /start)."""
        tg_user = await self._session.get(TgUser, tg_id)
        if tg_user is not None:
            return tg_user
        tg_user = TgUser(id=tg_id, status=default_status)
        self._session.add(tg_user)
        try:
            await self._session.flush()
        except IntegrityError:
            await self._session.rollback()
            tg_user = await self._session.get(TgUser, tg_id)
            if tg_user is None:
                raise
        return tg_user

    async def add(self, tg_user: TgUser) -> None:
        self._session.add(tg_user)

    async def exists(self, tg_id: int) -> bool:
        result = await self._session.execute(select(TgUser.id).where(TgUser.id == tg_id))
        return result.scalar_one_or_none() is not None
    
    async def update_status(self, tg_user: TgUser, status: str) -> None:
        tg_user.status = status