from __future__ import annotations

import smtplib

import anyio

from app.core.config import settings
from app.infrastructure.email.email_attachment import EmailAttachment
from app.infrastructure.email.email_templates.request_notification_email import build_request_notification_email_payload
from app.infrastructure.email.reply_token_codec import ReplyTokenCodec
from app.infrastructure.email_service import SMTPEmailService
from app.repositories.profiles import ProfileRepository
from app.repositories.requests import RequestRepository

MAX_EMAIL_ATTACHMENT_SIZE_MB = 20


class SendRequestNotificationEmailUseCase:
    def __init__(
        self,
        *,
        request_repository: RequestRepository,
        profile_repository: ProfileRepository,
        email_service: SMTPEmailService,
        app_url: str,
    ) -> None:
        self._request_repository = request_repository
        self._profile_repository = profile_repository
        self._email_service = email_service
        self._app_url = app_url.rstrip("/")

    async def execute(self, *, request_id: int, contractor_role_id: int) -> None:
        request = await self._request_repository.get_by_id(request_id=request_id)
        if request is None:
            return

        recipients = await self._profile_repository.list_active_contractors(
            contractor_role_id=contractor_role_id,
        )
        if not recipients:
            return

        reply_secret = settings.reply_email_token_secret
        if not reply_secret:
            return

        token_codec = ReplyTokenCodec(secret=reply_secret)
        attachments, attachment_warning = await self._build_attachments(request_id=request_id)
        request_url = f"{self._app_url}/requests/{request_id}"

        for recipient in recipients:
            reply_token = await token_codec.create_token(
                request_id=request_id,
                user_id=recipient.id,
                ttl_seconds=settings.reply_email_ttl_seconds,
            )
            payload = build_request_notification_email_payload(
                to_email=recipient.mail.strip(),
                request_id=request_id,
                description=request.description,
                deadline_at=request.deadline_at,
                request_url=request_url,
                reply_token=reply_token,
                attachment_warning=attachment_warning,
            )
            try:
                await self._email_service.send_email(
                    to_email=payload.to_email,
                    subject=payload.subject,
                    text_content=payload.text_content,
                    html_content=payload.html_content,
                    attachments=attachments,
                    reply_token=payload.reply_token,
                )
            except smtplib.SMTPException:
                continue

    async def _build_attachments(self, *, request_id: int) -> tuple[list[EmailAttachment], str | None]:
        files = await self._request_repository.list_files_by_request_id(request_id=request_id)
        if not files:
            return [], None

        attachment_items: list[EmailAttachment] = []
        total_size_bytes = 0
        max_total_size_bytes = MAX_EMAIL_ATTACHMENT_SIZE_MB * 1024 * 1024

        for file in files:
            file_path = anyio.Path(file.path)
            if not await file_path.exists():
                continue
            content_bytes = await file_path.read_bytes()
            total_size_bytes += len(content_bytes)
            attachment_items.append(
                EmailAttachment(
                    filename=file.name,
                    content_bytes=content_bytes,
                    mime_type="application/octet-stream",
                )
            )

        if total_size_bytes > max_total_size_bytes:
            return [], (
                f"Вложения не добавлены: суммарный размер превышает {MAX_EMAIL_ATTACHMENT_SIZE_MB} МБ."
            )

        return attachment_items, None
