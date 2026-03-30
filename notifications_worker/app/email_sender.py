from __future__ import annotations

import base64
import logging
import mimetypes
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger(__name__)


def _build_reply_to_address(from_address: str, from_name: str, reply_token: str | None) -> str:
    if not reply_token:
        return formataddr((from_name, from_address))

    local_part, _, domain_part = from_address.partition("@")
    if not local_part or not domain_part:
        return formataddr((from_name, from_address))

    tagged = f"{local_part}+rt-{reply_token}@{domain_part}"
    return formataddr((from_name, tagged))


def _format_recipient_log(payload: dict) -> str:
    to_email = str(payload.get("to_email", "")).strip()
    recipient_context = payload.get("recipient_context")
    if isinstance(recipient_context, dict):
        user_login = str(recipient_context.get("user_login") or "").strip()
        tg_id = recipient_context.get("tg_id")
        if user_login:
            return f'"{to_email}" - "зарегистрированный пользователь - login={user_login}, tg_id={tg_id if tg_id is not None else "нет"}"'
    return f'"{to_email}" - "не зарегистрирован"'


async def send_email(payload: dict) -> None:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    username = os.getenv("EMAIL_ADDRESS")
    password = os.getenv("EMAIL_APP_PASSWORD")

    if not smtp_host or not username or not password:
        logger.warning("SMTP env vars are not configured. Skip email delivery")
        return

    to_email = str(payload.get("to_email", "")).strip()
    if not to_email:
        logger.warning("Email payload has no recipient")
        return

    from_address = str(payload.get("from_address") or username)
    from_name = str(payload.get("from_name") or os.getenv("EMAIL_FROM_NAME", "AcomOfferDesk"))

    message = EmailMessage()
    message["Subject"] = str(payload.get("subject") or "")
    message["From"] = formataddr((from_name, from_address))
    message["To"] = to_email
    message["Reply-To"] = _build_reply_to_address(from_address, from_name, payload.get("reply_token"))

    text_content = str(payload.get("text_content") or "")
    html_content = payload.get("html_content")
    message.set_content(text_content, subtype="plain", charset="utf-8")
    if html_content:
        message.add_alternative(str(html_content), subtype="html", charset="utf-8")

    for item in payload.get("attachments") or []:
        filename = str(item.get("filename") or "attachment.bin")
        content_base64 = item.get("content_base64")
        if not content_base64:
            continue
        content_bytes = base64.b64decode(content_base64)
        guessed = mimetypes.guess_type(filename)[0]
        mime_type = guessed or str(item.get("mime_type") or "application/octet-stream")
        maintype, subtype = mime_type.split("/", 1)
        message.add_attachment(content_bytes, maintype=maintype, subtype=subtype, filename=filename)

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20, context=context) as smtp:
            smtp.login(username, password)
            smtp.send_message(message, from_addr=from_address, to_addrs=[to_email])
        logger.info("Email sent to %s", _format_recipient_log(payload))
    except smtplib.SMTPException:
        logger.exception("Failed to send email to %s", _format_recipient_log(payload))
