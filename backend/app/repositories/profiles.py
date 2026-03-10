from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import Profile


class ProfileRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, profile: Profile) -> None:
        self._session.add(profile)

    async def get_by_id(self, user_id: str) -> Profile | None:
        result = await self._session.execute(select(Profile).where(Profile.id == user_id))
        return result.scalar_one_or_none()
    
    async def get_by_ids(self, user_ids: list[str]) -> list[Profile]:
        if not user_ids:
            return []
        result = await self._session.execute(select(Profile).where(Profile.id.in_(user_ids)))
        return list(result.scalars().all())
    
    async def update_mail_after_verification(self, user_id: str, email: str) -> bool:
        profile = await self.get_by_id(user_id)
        if profile is None:
            return False

        candidate = email.strip()
        if profile.mail.strip().lower() == candidate.lower():
            return True

        profile.mail = candidate
        return True