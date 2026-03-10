from __future__ import annotations

import smtplib
from urllib.parse import quote

from app.core.config import settings
from app.core.email_token import EmailVerificationClaims, EmailVerificationTokenCodec
from app.domain.exceptions import Conflict, Forbidden
from app.infrastructure.email_service import SMTPEmailService
from app.repositories.profiles import ProfileRepository


class EmailVerificationService:
    def __init__(self, profiles: ProfileRepository) -> None:
        self._profiles = profiles
        self._token_codec = EmailVerificationTokenCodec(
            secret=settings.email_verification_secret,
            ttl_seconds=settings.email_verification_ttl_seconds,
        )
        self._email_service = SMTPEmailService(
            smtp_host=settings.smtp_host,
            smtp_port=settings.smtp_port,
            username=settings.email_address,
            password=settings.email_app_password,
            from_address=settings.email_address,
            from_name=settings.email_from_name,
        )

    async def request_profile_verification(self, *, user_id: str, email: str) -> None:
        normalized_email = email.strip()
        token = await self._token_codec.create_profile_token(user_id=user_id, email=normalized_email)
        verification_link = self._build_frontend_verify_link(token=token)
        await self._send_verification_email(email=normalized_email, verification_link=verification_link)

    async def request_tg_registration_verification(self, *, tg_id: int, email: str, tg_token: str) -> None:
        normalized_email = email.strip()
        token = await self._token_codec.create_tg_registration_token(tg_id=tg_id, email=normalized_email)
        if not settings.web_base_url:
            raise Conflict("WEB_BASE_URL is not configured")
        verification_link = (
            f"{settings.web_base_url.rstrip('/')}/auth/tg/register"
            f"?token={quote(tg_token, safe='')}"
            f"&email_verification_token={quote(token, safe='')}"
        )
        await self._send_verification_email(email=normalized_email, verification_link=verification_link)

    async def confirm_profile_verification(self, *, token: str) -> bool:
        claims = await self._token_codec.parse_token(token)
        if claims.purpose != EmailVerificationTokenCodec.PURPOSE_PROFILE or not claims.user_id:
            raise Forbidden("Invalid verification flow")
        return await self._profiles.update_mail_after_verification(user_id=claims.user_id, email=claims.email)

    async def parse_claims(self, *, token: str) -> EmailVerificationClaims:
        return await self._token_codec.parse_token(token)

    async def _send_verification_email(self, *, email: str, verification_link: str) -> None:
        text_content = _build_verification_text_template(
            verification_link=verification_link,
            ttl_seconds=settings.email_verification_ttl_seconds,
        )
        html_content = _build_verification_html_template(
            verification_link=verification_link,
            ttl_seconds=settings.email_verification_ttl_seconds,
            service_name=settings.email_from_name,
        )
        try:
            await self._email_service.send_email(
                to_email=email,
                subject="AcomOfferDesk — подтверждение электронной почты",
                text_content=text_content,
                html_content=html_content,
            )
        except smtplib.SMTPException as exc:
            raise Conflict(f"Unable to send verification email: {exc}") from exc

    def _build_frontend_verify_link(self, *, token: str) -> str:
        if not settings.web_base_url:
            raise Conflict("WEB_BASE_URL is not configured")
        return f"{settings.web_base_url.rstrip('/')}/verify-email?token={quote(token, safe='')}"


def _build_verification_text_template(*, verification_link: str, ttl_seconds: int) -> str:
    ttl_minutes = max(1, ttl_seconds // 60)
    return (
        "Здравствуйте!\n\n"
        "Вы получили это письмо, потому что был запрошен доступ к подтверждению электронной почты в AcomOfferDesk.\n\n"
        "Подтвердите адрес по ссылке:\n"
        f"{verification_link}\n\n"
        f"Ссылка действительна {ttl_minutes} минут.\n\n"
        "Если вы не запрашивали подтверждение — просто проигнорируйте это письмо."
    )


def _build_verification_html_template(*, verification_link: str, ttl_seconds: int, service_name: str) -> str:
    ttl_minutes = max(1, ttl_seconds // 60)
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
                {service_name}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 0 28px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:16px;line-height:24px;">
                Здравствуйте!<br/><br/>
                Подтвердите адрес электронной почты для вашей учетной записи.
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td bgcolor="#0969da" style="border-radius:6px;">
                      <a href="{verification_link}" style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#ffffff;text-decoration:none;">
                        Подтвердить email
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:14px;line-height:22px;">
                Если кнопка не работает, откройте ссылку вручную:<br/>
                <a href="{verification_link}" style="color:#0969da;text-decoration:underline;word-break:break-all;">{verification_link}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0 28px;font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:14px;line-height:22px;">
                Срок действия ссылки: <strong>{ttl_minutes} минут</strong>.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 24px 28px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:13px;line-height:20px;">
                Если вы не запрашивали подтверждение — проигнорируйте это письмо.<br/>
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
