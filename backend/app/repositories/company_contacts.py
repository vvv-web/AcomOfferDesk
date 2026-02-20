from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import CompanyContact


class CompanyContactRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, company_contact: CompanyContact) -> None:
        self._session.add(company_contact)

    async def get_by_id(self, user_id: str) -> CompanyContact | None:
        result = await self._session.execute(select(CompanyContact).where(CompanyContact.id == user_id))
        return result.scalar_one_or_none()