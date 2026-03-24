from __future__ import annotations

from sqlalchemy import Select, delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.orm_models import Chat, File, Message, MessageFile, Offer, OfferFile, TgUser, User


class OfferRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, *, request_id: int, contractor_user_id: str, offer_amount: float | None = None) -> Offer:
        offer = Offer(id_request=request_id, id_user=contractor_user_id, offer_amount=offer_amount)
        self._session.add(offer)
        await self._session.flush()
        return offer

    async def get_by_id(self, *, offer_id: int) -> Offer | None:
        stmt = select(Offer).where(Offer.id == offer_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def update_status(self, *, offer: Offer, status: str) -> None:
        offer.status = status

    async def update_amount(self, *, offer: Offer, offer_amount: float) -> None:
        offer.offer_amount = offer_amount

    async def get_contractor_offer_for_request(self, *, request_id: int, contractor_user_id: str) -> Offer | None:
        stmt: Select[tuple[Offer]] = (
            select(Offer)
            .where(Offer.id_request == request_id, Offer.id_user == contractor_user_id)
            .order_by(Offer.created_at.desc(), Offer.id.desc())
        )
        result = await self._session.execute(stmt)
        return result.scalars().first()

    async def list_by_request(self, *, request_id: int) -> list[Offer]:
        stmt: Select[tuple[Offer]] = (
            select(Offer)
            .where(Offer.id_request == request_id)
            .order_by(Offer.created_at.desc(), Offer.id.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_offer_files(self, *, offer_id: int) -> list[File]:
        stmt: Select[tuple[File]] = (
            select(File)
            .options(joinedload(File.storage_object))
            .join(OfferFile, OfferFile.id == File.id)
            .where(OfferFile.id_offer == offer_id)
            .order_by(File.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def attach_file(self, *, offer_id: int, file_id: int) -> None:
        self._session.add(OfferFile(id=file_id, id_offer=offer_id))

    async def detach_file(self, *, offer_id: int, file_id: int) -> bool:
        stmt = delete(OfferFile).where(OfferFile.id_offer == offer_id, OfferFile.id == file_id)
        result = await self._session.execute(stmt)
        return bool(result.rowcount)

    async def get_chat(self, *, offer_id: int) -> Chat | None:
        stmt = select(Chat).where(Chat.id == offer_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_contractor_tg_ids_for_request(self, *, request_id: int, contractor_role_id: int) -> list[int]:
        stmt = (
            select(User.tg_user_id)
            .select_from(Offer)
            .join(User, User.id == Offer.id_user)
            .join(TgUser, TgUser.id == User.tg_user_id)
            .where(Offer.id_request == request_id)
            .where(User.id_role == contractor_role_id)
            .where(User.status == "active")
            .where(User.tg_user_id.is_not(None))
            .where(TgUser.status == "approved")
            .distinct()
            .order_by(User.tg_user_id.asc())
        )
        result = await self._session.execute(stmt)
        return [tg_id for tg_id in result.scalars().all() if tg_id is not None]

    async def is_file_linked(self, *, offer_id: int, file_id: int) -> bool:
        stmt = select(OfferFile.id).where(OfferFile.id_offer == offer_id, OfferFile.id == file_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def is_file_linked_to_contractor(self, *, contractor_user_id: str, file_id: int) -> bool:
        stmt = (
            select(OfferFile.id)
            .join(Offer, Offer.id == OfferFile.id_offer)
            .where(OfferFile.id == file_id, Offer.id_user == contractor_user_id)
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None
    
    async def is_message_file_linked_to_contractor(self, *, contractor_user_id: str, file_id: int) -> bool:
        stmt = (
            select(MessageFile.id)
            .join(Message, Message.id == MessageFile.id_message)
            .join(Chat, Chat.id == Message.id_chat)
            .join(Offer, Offer.id == Chat.id)
            .where(MessageFile.id == file_id, Offer.id_user == contractor_user_id)
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None
