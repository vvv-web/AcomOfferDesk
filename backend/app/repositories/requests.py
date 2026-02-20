from __future__ import annotations

from datetime import datetime

from sqlalchemy import Select, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import (
    Chat,
    CompanyContact,
    File,
    Message,
    Offer,
    OfferFile,
    Profile,
    Request,
    RequestFile,
    RequestOfferStats,
    User,
)


class RequestRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, request: Request) -> None:
        self._session.add(request)

    async def create(
        self,
        *,
        id_user: str,
        deadline_at: datetime,
        description: str | None,
    ) -> Request:
        request = Request(
            id_user=id_user,
            deadline_at=deadline_at,
            description=description,
        )
        self._session.add(request)
        await self._session.flush()
        return request

    async def get_by_id(self, *, request_id: int) -> Request | None:
        stmt = select(Request).where(Request.id == request_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_latest_accepted_offer_id(self, *, request_id: int) -> int | None:
        stmt = (
            select(Offer.id)
            .where(Offer.id_request == request_id, Offer.status == "accepted")
            .order_by(Offer.created_at.desc(), Offer.id.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(
        self,
        *,
        request: Request,
        status: str,
        closed_at: datetime | None = None,
        chosen_offer_id: int | None = None,
    ) -> None:
        request.status = status
        request.closed_at = closed_at
        request.id_offer = chosen_offer_id

    async def update_deadline(self, *, request: Request, deadline_at: datetime) -> None:
        request.deadline_at = deadline_at

    async def update_owner(self, *, request: Request, user_id: str) -> None:
        request.id_user = user_id

    async def attach_file(self, *, request_id: int, file_id: int) -> None:
        self._session.add(RequestFile(id=file_id, id_request=request_id))

    async def detach_file(self, *, request_id: int, file_id: int) -> bool:
        stmt = delete(RequestFile).where(RequestFile.id_request == request_id, RequestFile.id == file_id)
        result = await self._session.execute(stmt)
        return bool(result.rowcount)
    
    async def get_open_by_id(self, *, request_id: int) -> Request | None:
        stmt = select(Request).where(Request.id == request_id, Request.status == "open")
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def is_file_linked_to_open_request(self, *, file_id: int) -> bool:
        stmt = (
            select(RequestFile.id)
            .join(Request, Request.id == RequestFile.id_request)
            .where(RequestFile.id == file_id, Request.status == "open")
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def list_open(self) -> list[Request]:
        stmt = select(Request).where(Request.status == "open").order_by(Request.created_at.desc(), Request.id.desc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
    
    async def list_with_stats_and_files(
        self,
        *,
        current_user_id: str,
    ) -> list[tuple[Request, RequestOfferStats | None, RequestFile | None, File | None, int]]:
        unread_messages_count = (
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.id_chat)
            .join(Offer, Offer.id == Chat.id)
            .where(
                Offer.id_request == Request.id,
                Message.id_user != current_user_id,
                Message.status != "read",
            )
            .correlate(Request)
            .scalar_subquery()
        )

        stmt: Select[tuple[Request, RequestOfferStats | None, RequestFile | None, File | None, int]] = (
            select(Request, RequestOfferStats, RequestFile, File, unread_messages_count)
            .outerjoin(RequestOfferStats, RequestOfferStats.request_id == Request.id)
            .outerjoin(RequestFile, RequestFile.id_request == Request.id)
            .outerjoin(File, File.id == RequestFile.id)
            .order_by(Request.created_at.desc(), Request.id.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())
    
    async def list_open_with_files(self) -> list[tuple[Request, RequestFile | None, File | None]]:
        stmt: Select[tuple[Request, RequestFile | None, File | None]] = (
            select(Request, RequestFile, File)
            .outerjoin(RequestFile, RequestFile.id_request == Request.id)
            .outerjoin(File, File.id == RequestFile.id)
            .where(Request.status == "open")
            .order_by(Request.created_at.desc(), Request.id.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def list_with_offers_for_contractor(
        self, *, contractor_user_id: str
    ) -> list[tuple[Request, Offer, RequestFile | None, File | None, int]]:
        unread_messages_count = (
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.id_chat)
            .where(
                Chat.id == Offer.id,
                Message.id_user != contractor_user_id,
                Message.status != "read",
            )
            .correlate(Offer)
            .scalar_subquery()
        )
        stmt: Select[tuple[Request, Offer, RequestFile | None, File | None, int]] = (
            select(Request, Offer, RequestFile, File, unread_messages_count)
            .join(Offer, Offer.id_request == Request.id)
            .join(User, User.id == Offer.id_user)
            .outerjoin(RequestFile, RequestFile.id_request == Request.id)
            .outerjoin(File, File.id == RequestFile.id)
            .where(Offer.id_user == contractor_user_id, User.status == "active")
            .order_by(Request.created_at.desc(), Request.id.desc(), Offer.created_at.desc(), Offer.id.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())
    
    async def list_open_with_stats_and_files(self) -> list[tuple[Request, RequestOfferStats | None, RequestFile | None, File | None]]:
        stmt: Select[tuple[Request, RequestOfferStats | None, RequestFile | None, File | None]] = (
            select(Request, RequestOfferStats, RequestFile, File)
            .outerjoin(RequestOfferStats, RequestOfferStats.request_id == Request.id)
            .outerjoin(RequestFile, RequestFile.id_request == Request.id)
            .outerjoin(File, File.id == RequestFile.id)
            .where(Request.status == "open")
            .order_by(Request.created_at.desc(), Request.id.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def decrement_deleted_alert(self, *, request_id: int) -> RequestOfferStats | None:
        stmt = select(RequestOfferStats).where(RequestOfferStats.request_id == request_id)
        result = await self._session.execute(stmt)
        stats = result.scalar_one_or_none()
        if stats is None:
            return None

        if stats.count_deleted_alert > 0:
            stats.count_deleted_alert -= 1
        stats.updated_at = datetime.utcnow()
        await self._session.flush()
        return stats

    async def get_with_stats(self, *, request_id: int) -> tuple[Request, RequestOfferStats | None] | None:
        stmt: Select[tuple[Request, RequestOfferStats | None]] = (
            select(Request, RequestOfferStats)
            .outerjoin(RequestOfferStats, RequestOfferStats.request_id == Request.id)
            .where(Request.id == request_id)
        )
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return None
        return row

    async def list_files(self, *, request_id: int) -> list[File]:
        stmt: Select[tuple[File]] = (
            select(File)
            .join(RequestFile, RequestFile.id == File.id)
            .where(RequestFile.id_request == request_id)
            .order_by(File.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_offers_with_files_and_contacts(
        self,
        *,
        request_id: int,
    current_user_id: str,
    ) -> list[tuple[Offer, File | None, Profile | None, CompanyContact | None, int]]:
        unread_messages_count = (
            select(func.count())
            .select_from(Message)
            .join(Chat, Chat.id == Message.id_chat)
            .where(
                Chat.id == Offer.id,
                Message.id_user != current_user_id,
                Message.status != "read",
            )
            .correlate(Offer)
            .scalar_subquery()
        )

        stmt: Select[tuple[Offer, File | None, Profile | None, CompanyContact | None, int]] = (
            select(Offer, File, Profile, CompanyContact, unread_messages_count)
            .outerjoin(OfferFile, OfferFile.id_offer == Offer.id)
            .outerjoin(File, File.id == OfferFile.id)
            .outerjoin(Profile, Profile.id == Offer.id_user)
            .outerjoin(CompanyContact, CompanyContact.id == Offer.id_user)
            .where(Offer.id_request == request_id)
            .order_by(Offer.created_at.desc(), Offer.id.desc(), File.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())