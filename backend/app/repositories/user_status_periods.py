from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import UserStatusPeriod


class UserStatusPeriodRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, period: UserStatusPeriod) -> None:
        self._session.add(period)

    async def list_for_user(self, *, user_id: str) -> list[UserStatusPeriod]:
        query: Select[tuple[UserStatusPeriod]] = (
            select(UserStatusPeriod)
            .where(UserStatusPeriod.id_user == user_id)
            .order_by(UserStatusPeriod.started_at.desc(), UserStatusPeriod.id.desc())
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_active_for_user(self, *, user_id: str) -> UserStatusPeriod | None:
        query: Select[tuple[UserStatusPeriod]] = (
            select(UserStatusPeriod)
            .where(
                UserStatusPeriod.id_user == user_id,
                UserStatusPeriod.started_at <= func.now(),
                UserStatusPeriod.ended_at >= func.now(),
            )
            .order_by(UserStatusPeriod.ended_at.desc(), UserStatusPeriod.id.desc())
            .limit(1)
        )
        result = await self._session.execute(query)
        return result.scalar_one_or_none()
    
    async def list_for_users(self, *, user_ids: list[str]) -> dict[str, list[UserStatusPeriod]]:
        if not user_ids:
            return {}

        query: Select[tuple[UserStatusPeriod]] = (
            select(UserStatusPeriod)
            .where(UserStatusPeriod.id_user.in_(user_ids))
            .order_by(
                UserStatusPeriod.id_user.asc(),
                UserStatusPeriod.started_at.desc(),
                UserStatusPeriod.id.desc(),
            )
        )
        result = await self._session.execute(query)
        grouped: dict[str, list[UserStatusPeriod]] = {}
        for period in result.scalars().all():
            grouped.setdefault(period.id_user, []).append(period)
        return grouped

    async def list_active_for_users(self, *, user_ids: list[str]) -> dict[str, UserStatusPeriod]:
        if not user_ids:
            return {}

        query: Select[tuple[UserStatusPeriod]] = (
            select(UserStatusPeriod)
            .where(
                UserStatusPeriod.id_user.in_(user_ids),
                UserStatusPeriod.started_at <= func.now(),
                UserStatusPeriod.ended_at >= func.now(),
            )
            .order_by(
                UserStatusPeriod.id_user.asc(),
                UserStatusPeriod.ended_at.desc(),
                UserStatusPeriod.id.desc(),
            )
        )
        result = await self._session.execute(query)
        active_by_user: dict[str, UserStatusPeriod] = {}
        for period in result.scalars().all():
            if period.id_user not in active_by_user:
                active_by_user[period.id_user] = period
        return active_by_user
