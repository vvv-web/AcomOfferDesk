from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import File

class FileRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, *, path: str, name: str) -> File:
        db_file = File(path=path, name=name)
        self._session.add(db_file)
        await self._session.flush()
        return db_file
    
    async def get_by_path_and_name(self, *, path: str, name: str) -> File | None:
        stmt = select(File).where(File.path == path, File.name == name)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def delete_by_id(self, *, file_id: int) -> bool:
        stmt = delete(File).where(File.id == file_id)
        result = await self._session.execute(stmt)
        return bool(result.rowcount)
    
    async def get_by_id(self, file_id: int) -> File | None:
        stmt = select(File).where(File.id == file_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_ids(self, *, file_ids: Sequence[int]) -> list[File]:
        if not file_ids:
            return []
        stmt = select(File).where(File.id.in_(file_ids)).order_by(File.id.asc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
