from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

import anyio


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

    async def send_email(self, *, to_email: str, subject: str, text_content: str, html_content: str | None = None) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((self._from_name, self._from_address))
        message["To"] = to_email
        message["Reply-To"] = self._from_address
        message["Date"] = formatdate(localtime=True)
        message["Message-ID"] = make_msgid(domain=self._from_address.split("@")[-1])
        message["MIME-Version"] = "1.0"

        message.set_content(text_content, subtype="plain", charset="utf-8")
        if html_content:
            message.add_alternative(html_content, subtype="html", charset="utf-8")

        await anyio.to_thread.run_sync(self._send_sync, message, to_email)

    def _send_sync(self, message: EmailMessage, to_email: str) -> None:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(self._smtp_host, self._smtp_port, timeout=20, context=context) as smtp:
            smtp.login(self._username, self._password)
            smtp.send_message(
                message,
                from_addr=self._from_address,
                to_addrs=[to_email],
            )
