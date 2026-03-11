from __future__ import annotations

from datetime import datetime
from html import escape

from app.infrastructure.email.email_message_payload import EmailMessagePayload


def build_request_notification_email_payload(
    *,
    to_email: str,
    request_id: int,
    description: str | None,
    deadline_at: datetime,
    request_url: str,
    reply_token: str,
    attachment_warning: str | None = None,
) -> EmailMessagePayload:
    subject = f"AcomOfferDesk — новая заявка №{request_id} [rt:{reply_token}]"
    return EmailMessagePayload(
        to_email=to_email,
        subject=subject,
        text_content=_build_request_notification_text_template(
            request_id=request_id,
            description=description,
            deadline_at=deadline_at,
            request_url=request_url,
            reply_token=reply_token,
            attachment_warning=attachment_warning,
        ),
        html_content=_build_request_notification_html_template(
            request_id=request_id,
            description=description,
            deadline_at=deadline_at,
            request_url=request_url,
            reply_token=reply_token,
            attachment_warning=attachment_warning,
        ),
    )


def _build_request_notification_text_template(
    *,
    request_id: int,
    description: str | None,
    deadline_at: datetime,
    request_url: str,
    reply_token: str,
    attachment_warning: str | None,
) -> str:
    deadline_label = deadline_at.strftime("%d.%m.%Y %H:%M")
    request_description = description or "Описание не указано"
    warning_block = f"\n\nВнимание: {attachment_warning}" if attachment_warning else ""

    return (
        "AcomOfferDesk\n\n"
        f"Новая заявка №{request_id}\n"
        f"Описание: {request_description}\n"
        f"Дедлайн: {deadline_label}\n\n"
        f"Открыть заявку: {request_url}\n"
        f"Reply token: {reply_token}"
        f"{warning_block}\n"
    )


def _build_request_notification_html_template(
    *,
    request_id: int,
    description: str | None,
    deadline_at: datetime,
    request_url: str,
    reply_token: str,
    attachment_warning: str | None,
) -> str:
    deadline_label = deadline_at.strftime("%d.%m.%Y %H:%M")
    request_description = escape(description or "Описание не указано")
    escaped_url = escape(request_url)
    escaped_reply_token = escape(reply_token)
    warning_html = (
        f"""
            <tr>
              <td style="padding:8px 28px 0 28px;font-family:Arial,Helvetica,sans-serif;color:#b45309;font-size:14px;line-height:22px;">
                <strong>Внимание:</strong> {escape(attachment_warning)}
              </td>
            </tr>
        """.rstrip()
        if attachment_warning
        else ""
    )

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
            {warning_html}
            <tr>
              <td style="padding:8px 28px 0 28px;font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:14px;line-height:22px;">
                Reply token: <span style="word-break:break-all;">{escaped_reply_token}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:14px;line-height:22px;">
                Если кнопка не работает, откройте ссылку вручную:<br/>
                <a href="{escaped_url}" style="color:#0969da;text-decoration:underline;word-break:break-all;">{escaped_url}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()
