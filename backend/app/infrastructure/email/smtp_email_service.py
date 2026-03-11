from __future__ import annotations

import logging
import mimetypes
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

import anyio

from app.infrastructure.email.email_message_payload import EmailMessagePayload
from app.infrastructure.email.email_attachment import EmailAttachment

logger = logging.getLogger(__name__)


class SMTPEmailService:
    def __init__(
        self,
        *,
        smtp_host: str,
        smtp_port: int,
        username: str,
        password: str,
        from_address: str,
        from_name: str,
    ) -> None:
        self._smtp_host = smtp_host
        self._smtp_port = smtp_port
        self._username = username
        self._password = password
        self._from_address = from_address
        self._from_name = from_name

    async def send_email(
        self,
        to_email: str,
        subject: str,
        text_content: str,
        html_content: str | None = None,
        attachments: list[EmailAttachment] | None = None,
    ) -> None:
        payload = EmailMessagePayload(
            to_email=to_email,
            subject=subject,
            text_content=text_content,
            html_content=html_content,
            attachments=attachments,
        )
        message = self._build_mime_message(payload)
        await anyio.to_thread.run_sync(self._send_sync, message, payload.to_email)

    def _build_mime_message(self, payload: EmailMessagePayload) -> EmailMessage:
        message = EmailMessage()
        message["Subject"] = payload.subject
        message["From"] = formataddr((self._from_name, self._from_address))
        message["To"] = payload.to_email
        message["Reply-To"] = self._from_address
        message["Date"] = formatdate(localtime=True)
        message["Message-ID"] = make_msgid(domain=self._from_address.split("@")[-1])
        message["MIME-Version"] = "1.0"

        message.set_content(payload.text_content, subtype="plain", charset="utf-8")
        if payload.html_content:
            message.add_alternative(payload.html_content, subtype="html", charset="utf-8")

        for attachment in payload.attachments or []:
            guessed_mime_type = mimetypes.guess_type(attachment.filename)[0]
            mime_type = guessed_mime_type or attachment.mime_type or "application/octet-stream"
            maintype, subtype = mime_type.split("/", 1)
            message.add_attachment(
                attachment.content_bytes,
                maintype=maintype,
                subtype=subtype,
                filename=attachment.filename,
            )

        return message

    def _send_sync(self, message: EmailMessage, to_email: str) -> None:
        context = ssl.create_default_context()
        smtp = smtplib.SMTP_SSL(
            self._smtp_host,
            self._smtp_port,
            timeout=20,
            context=context,
        )
        try:
            smtp.login(self._username, self._password)
            smtp.send_message(
                message,
                from_addr=self._from_address,
                to_addrs=[to_email],
            )
        except smtplib.SMTPException:
            logger.exception("Failed to send email to %s", to_email)
            raise
        finally:
            try:
                smtp.quit()
            except smtplib.SMTPException:
                logger.warning("Failed to close SMTP connection gracefully")
