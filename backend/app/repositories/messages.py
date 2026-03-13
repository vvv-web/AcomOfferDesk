from __future__ import annotations

from collections.abc import Sequence
import re

from sqlalchemy import Select, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import File, Message, MessageFile


EMAIL_MESSAGE_ID_MARKER = "[email_message_id:"
AUTO_EMAIL_MESSAGE_PREFIX = "Сообщение сформировано автоматически из письма"
AUTO_EMAIL_OFFER_CREATED_TEXT = "Оффер сформирован автоматически из письма"


def strip_email_message_marker(text: str) -> str:
    normalized = text.strip()
    pattern = rf"^{re.escape(EMAIL_MESSAGE_ID_MARKER)}[^\]]+\]\s*"
    cleaned = re.sub(pattern, "", normalized, count=1)
    return cleaned.strip()

def build_auto_email_content(*, text: str) -> str:
    clean_text = text.strip()
    if clean_text:
        return f"{AUTO_EMAIL_MESSAGE_PREFIX}\n\n{clean_text}"
    return ""


def build_email_message_text(*, text: str, message_id: str) -> str:
    marker = f"{EMAIL_MESSAGE_ID_MARKER}{message_id}]"
    clean_text = text.strip()
    if clean_text:
        return f"{marker}\n\n{clean_text}"
    return marker

class MessageRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        *,
        chat_id: int,
        user_id: str,
        text: str,
        status: str = "received",
    ) -> Message:
        message = Message(id_chat=chat_id, id_user=user_id, text=text, status=status)
        self._session.add(message)
        await self._session.flush()
        return message

    async def list_by_chat(self, *, chat_id: int) -> list[Message]:
        stmt: Select[tuple[Message]] = (
            select(Message)
            .where(Message.id_chat == chat_id)
            .order_by(Message.created_at.asc(), Message.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_files_by_message_ids(self, *, message_ids: Sequence[int]) -> list[tuple[int, File]]:
        if not message_ids:
            return []

        stmt: Select[tuple[int, File]] = (
            select(MessageFile.id_message, File)
            .join(File, File.id == MessageFile.id)
            .where(MessageFile.id_message.in_(message_ids))
            .order_by(MessageFile.id_message.asc(), File.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def attach_file(self, *, message_id: int, file_id: int) -> None:
        self._session.add(MessageFile(id=file_id, id_message=message_id))

    async def update_status_for_recipient(
        self,
        *,
        chat_id: int,
        message_ids: Sequence[int] | None,
        recipient_user_id: str,
        from_status: str,
        to_status: str,
    ) -> int:
        if not message_ids:
            return 0

        stmt = (
            update(Message)
            .where(
                Message.id_chat == chat_id,
                Message.id.in_(message_ids),
                Message.status == from_status,
                Message.id_user != recipient_user_id,
            )
            .values(status=to_status)
        )
        result = await self._session.execute(stmt)
        return int(result.rowcount or 0)
    
    async def exists_with_email_message_id(self, *, email_message_id: str) -> bool:
        marker = f"{EMAIL_MESSAGE_ID_MARKER}{email_message_id}]"
        stmt = select(Message.id).where(Message.text.contains(marker)).limit(1)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None