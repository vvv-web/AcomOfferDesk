from __future__ import annotations

import smtplib
from urllib.parse import quote

from app.core.config import settings
from app.core.email_token import EmailVerificationClaims, EmailVerificationTokenCodec
from app.domain.exceptions import Conflict, Forbidden
from app.infrastructure.email.email_templates.verification_email import build_verification_email_payload
from app.infrastructure.email.smtp_email_service import SMTPEmailService
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
        payload = build_verification_email_payload(
            to_email=email,
            verification_link=verification_link,
            ttl_seconds=settings.email_verification_ttl_seconds,
            service_name=settings.email_from_name,
        )
        try:
            await self._email_service.send_email(
                payload.to_email,
                payload.subject,
                payload.text_content,
                payload.html_content,
            )
        except smtplib.SMTPException as exc:
            raise Conflict(f"Unable to send verification email: {exc}") from exc

    def _build_frontend_verify_link(self, *, token: str) -> str:
        if not settings.web_base_url:
            raise Conflict("WEB_BASE_URL is not configured")
        return f"{settings.web_base_url.rstrip('/')}/verify-email?token={quote(token, safe='')}"
