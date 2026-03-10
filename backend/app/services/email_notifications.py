from __future__ import annotations

from datetime import datetime
from html import escape
import smtplib

from app.core.config import settings
from app.infrastructure.email_service import SMTPEmailService
from app.repositories.profiles import ProfileRepository


class EmailNotificationService:
    def __init__(self, profiles: ProfileRepository) -> None:
        self._profiles = profiles
        self._email_service = SMTPEmailService(
            smtp_host=settings.smtp_host,
            smtp_port=settings.smtp_port,
            username=settings.email_address,
            password=settings.email_app_password,
            from_address=settings.email_address,
            from_name=settings.email_from_name,
        )

    async def notify_new_request(
        self,
        *,
        request_id: int,
        description: str | None,
        deadline_at: datetime,
    ) -> None:
        if not settings.web_base_url:
            return

        recipients = await self._profiles.list_active_contractor_emails(
            contractor_role_id=settings.contractor_role_id,
        )
        if not recipients:
            return

        request_url = f"{settings.web_base_url.rstrip('/')}/requests/{request_id}"
        subject = f"AcomOfferDesk — новая заявка №{request_id}"
        text_content = _build_request_notification_text_template(
            request_id=request_id,
            description=description,
            deadline_at=deadline_at,
            request_url=request_url,
        )
        html_content = _build_request_notification_html_template(
            request_id=request_id,
            description=description,
            deadline_at=deadline_at,
            request_url=request_url,
        )

        for recipient in recipients:
            try:
                await self._email_service.send_email(
                    to_email=recipient,
                    subject=subject,
                    text_content=text_content,
                    html_content=html_content,
                )
            except smtplib.SMTPException:
                continue


def _build_request_notification_text_template(
    *,
    request_id: int,
    description: str | None,
    deadline_at: datetime,
    request_url: str,
) -> str:
    deadline_label = deadline_at.strftime("%d.%m.%Y %H:%M")
    request_description = description or "Описание не указано"
    return (
        "AcomOfferDesk\n\n"
        f"Новая заявка №{request_id}\n"
        f"Описание: {request_description}\n"
        f"Дедлайн: {deadline_label}\n\n"
        f"Открыть заявку: {request_url}\n"
    )


def _build_request_notification_html_template(
    *,
    request_id: int,
    description: str | None,
    deadline_at: datetime,
    request_url: str,
) -> str:
    deadline_label = deadline_at.strftime("%d.%m.%Y %H:%M")
    request_description = escape(description or "Описание не указано")
    escaped_url = escape(request_url)

    return f"""
<!DOCTYPE html>
<html lang="ru">
  <body style="margin:0;padding:0;background-color:#f6f8fb;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f6f8fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e6e8eb;border-radius:10px;">
            <tr>
              <td style="padding:24px 28px 8px 28px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:22px;font-weight:700;">
                AcomOfferDesk
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:16px;line-height:24px;">
                Поступила новая заявка <strong>№{request_id}</strong>.<br/><br/>
                <strong>Описание:</strong> {request_description}<br/>
                <strong>Дедлайн:</strong> {deadline_label}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td bgcolor="#0969da" style="border-radius:6px;">
                      <a href="{escaped_url}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#ffffff;text-decoration:none;">
                        Открыть заявку
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:14px;line-height:22px;">
                Если кнопка не работает, откройте ссылку вручную:<br/>
                <a href="{escaped_url}" style="color:#0969da;text-decoration:underline;word-break:break-all;">{escaped_url}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:13px;line-height:20px;">
                Это автоматическое уведомление AcomOfferDesk. Пожалуйста, не отвечайте на это письмо.<br/>
                © AcomOfferDesk
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()
