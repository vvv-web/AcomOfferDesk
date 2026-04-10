from __future__ import annotations

import time
from urllib.parse import quote
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.api.action_flags import serialize_permissions
from app.api.dependencies import get_current_user, get_uow
from app.core.auth_cookies import (
    clear_keycloak_refresh_cookie,
    clear_keycloak_state_cookie,
    clear_refresh_cookie,
    set_keycloak_refresh_cookie,
    set_keycloak_state_cookie,
    set_refresh_cookie,
)
from app.core.config import settings
from app.core.oidc_state_tokens import (
    build_keycloak_login_url,
    build_oidc_authorization_start,
    decode_oidc_state_token,
)
from app.core.session_tokens import build_refresh_fingerprint, decode_refresh_token
from app.core.uow import UnitOfWork
from app.domain.auth_context import CurrentUser, build_current_user
from app.domain.exceptions import Conflict, Forbidden, Unauthorized
from app.domain.policies import UserPolicy
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterUserRequest,
    RegisterUserResponse,
)
from app.schemas.links import Link, LinkSet
from app.services.auth_session import AuthSessionBundle, AuthSessionService
from app.services.email_verification import EmailVerificationService
from app.services.identity_sync import IdentitySyncService
from app.services.keycloak_oidc import (
    decode_keycloak_access_token,
    exchange_code_for_tokens,
    refresh_tokens,
)
from app.services.users import UserRegistrationService

router = APIRouter()


class RequestEmailVerificationRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class EmailVerificationActionResponse(BaseModel):
    detail: str


def _build_auth_links(*, self_href: str) -> LinkSet:
    return LinkSet(
        self=Link(href=self_href, method="POST"),
    )


def _resolve_request_base_url(request: Request) -> str:
    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    forwarded_host = (request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
    host = forwarded_host or (request.headers.get("host") or "").strip() or request.url.netloc
    scheme = forwarded_proto or request.url.scheme or "http"
    configured_public_base = (settings.public_backend_base_url or settings.web_base_url or "").strip().rstrip("/")
    if configured_public_base:
        configured_public = urlsplit(configured_public_base)
        configured_host = (configured_public.netloc or "").strip().lower()
        if configured_host and host.strip().lower() == configured_host:
            scheme = configured_public.scheme or scheme
    if host:
        return f"{scheme}://{host}".rstrip("/")
    return (settings.public_backend_base_url or settings.web_base_url or str(request.base_url)).rstrip("/")


def _extract_base_url_from_redirect_uri(redirect_uri: str) -> str:
    parsed = urlsplit(redirect_uri)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    return (settings.web_base_url or settings.public_backend_base_url or "http://localhost:8080").rstrip("/")


def _onboarding_state(status_value: str) -> str | None:
    return None if status_value == "active" else status_value


def _build_auth_response(
    *,
    access_token: str,
    access_token_expires_at: int,
    user_id: str,
    role_id: int,
    status_value: str,
    auth_provider: str,
    self_href: str,
) -> LoginResponse:
    current_user = build_current_user(
        user_id=user_id,
        role_id=role_id,
        status=status_value,
    )
    return LoginResponse(
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "access_token_expires_at": access_token_expires_at,
            "user_id": user_id,
            "login": user_id,
            "role_id": role_id,
            "status": status_value,
            "auth_provider": auth_provider,
            "business_access": status_value == "active",
            "onboarding_state": _onboarding_state(status_value),
            "permissions": serialize_permissions(current_user),
        },
        _links=_build_auth_links(self_href=self_href),
    )


def _build_legacy_auth_response(*, session: AuthSessionBundle, self_href: str) -> LoginResponse:
    return _build_auth_response(
        access_token=session.access_token,
        access_token_expires_at=session.access_token_expires_at,
        user_id=session.user_id,
        role_id=session.role_id,
        status_value=session.status,
        auth_provider="legacy",
        self_href=self_href,
    )


async def _build_keycloak_auth_response(
    *,
    access_token: str,
    self_href: str,
    uow: UnitOfWork,
) -> LoginResponse:
    claims = await decode_keycloak_access_token(access_token)
    sync_service = IdentitySyncService(
        users=uow.users,
        user_auth_accounts=uow.user_auth_accounts,
        user_contact_channels=uow.user_contact_channels,
        profiles=uow.profiles,
    )
    synced = await sync_service.sync_keycloak_identity(claims, allow_user_creation=False)
    return _build_auth_response(
        access_token=access_token,
        access_token_expires_at=claims.expires_at,
        user_id=synced.user.id,
        role_id=synced.user.id_role,
        status_value=synced.user.status,
        auth_provider="keycloak",
        self_href=self_href,
    )


@router.post("/auth/request-email-verification", response_model=EmailVerificationActionResponse)
async def request_email_verification(
    payload: RequestEmailVerificationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> EmailVerificationActionResponse:
    async with uow:
        service = EmailVerificationService(uow.profiles)
        result = await service.request_profile_verification(user_id=current_user.user_id, email=payload.email)

    if result == "same_email":
        return EmailVerificationActionResponse(detail="Указан текущий подтвержденный email")
    if result == "already_sent":
        return EmailVerificationActionResponse(detail="Письмо уже отправлено. Проверьте вашу почту")
    return EmailVerificationActionResponse(detail="Письмо для подтверждения email отправлено")


@router.get("/auth/verify-email", response_model=EmailVerificationActionResponse)
async def verify_email(
    token: str = Query(..., min_length=20),
    uow: UnitOfWork = Depends(get_uow),
) -> EmailVerificationActionResponse:
    async with uow:
        service = EmailVerificationService(uow.profiles)
        updated = await service.confirm_profile_verification(token=token)

    if updated:
        return EmailVerificationActionResponse(detail="Email подтвержден")
    return EmailVerificationActionResponse(detail="Email уже подтвержден")


@router.get("/auth/oidc/login", response_class=RedirectResponse)
async def begin_keycloak_login(
    request: Request,
    next_path: str | None = Query(default="/"),
) -> RedirectResponse:
    if not settings.keycloak_enabled:
        raise Forbidden("Keycloak authentication is disabled")

    redirect_uri = f"{_resolve_request_base_url(request)}/api/v1/auth/callback"
    start = build_oidc_authorization_start(next_path=next_path, flow="login", redirect_uri=redirect_uri)
    response = RedirectResponse(
        url=build_keycloak_login_url(
            state=start.state,
            code_challenge=start.code_challenge,
            redirect_uri=start.redirect_uri,
            prompt="login",
        ),
        status_code=status.HTTP_302_FOUND,
    )
    set_keycloak_state_cookie(
        response,
        start.cookie_token,
        max_age=max(0, start.expires_at - int(time.time())),
    )
    return response


@router.get("/auth/oidc/register", response_class=RedirectResponse)
async def begin_keycloak_registration(
    request: Request,
    next_path: str | None = Query(default="/account"),
) -> RedirectResponse:
    if not settings.keycloak_enabled:
        raise Forbidden("Keycloak authentication is disabled")

    redirect_uri = f"{_resolve_request_base_url(request)}/api/v1/auth/callback"
    start = build_oidc_authorization_start(next_path=next_path, flow="register", redirect_uri=redirect_uri)
    response = RedirectResponse(
        url=build_keycloak_login_url(
            state=start.state,
            code_challenge=start.code_challenge,
            redirect_uri=start.redirect_uri,
            prompt="create",
        ),
        status_code=status.HTTP_302_FOUND,
    )
    set_keycloak_state_cookie(
        response,
        start.cookie_token,
        max_age=max(0, start.expires_at - int(time.time())),
    )
    return response


@router.get("/auth/callback", response_class=RedirectResponse, response_model=None)
async def keycloak_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    uow: UnitOfWork = Depends(get_uow),
) -> RedirectResponse:
    if not settings.keycloak_enabled:
        raise Forbidden("Keycloak authentication is disabled")
    if error:
        raise Unauthorized("Keycloak token exchange failed")
    if not code or not state:
        raise Unauthorized("Missing credentials")

    state_cookie = (request.cookies.get(settings.keycloak_state_cookie_name) or "").strip()
    if not state_cookie:
        raise Unauthorized("Missing OIDC state")

    claims = decode_oidc_state_token(state_cookie)
    if claims.state != state:
        raise Unauthorized("Invalid OIDC state")

    bundle = await exchange_code_for_tokens(
        code=code,
        code_verifier=claims.code_verifier,
        redirect_uri=claims.redirect_uri,
    )
    web_base = _extract_base_url_from_redirect_uri(claims.redirect_uri)
    try:
        async with uow:
            token_claims = await decode_keycloak_access_token(bundle.access_token)
            sync_service = IdentitySyncService(
                users=uow.users,
                user_auth_accounts=uow.user_auth_accounts,
                user_contact_channels=uow.user_contact_channels,
                profiles=uow.profiles,
            )
            await sync_service.sync_keycloak_identity(
                token_claims,
                allow_user_creation=claims.flow == "register",
            )
    except (Forbidden, Conflict):
        response = RedirectResponse(url=f"{web_base}/auth/callback?error=not_linked", status_code=status.HTTP_302_FOUND)
        clear_keycloak_state_cookie(response)
        clear_keycloak_refresh_cookie(response)
        return response

    redirect_target = f"{web_base}/auth/callback?next={quote(claims.next_path, safe='/%?=&')}"
    response = RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)
    clear_keycloak_state_cookie(response)
    clear_refresh_cookie(response)
    set_keycloak_refresh_cookie(response, bundle.refresh_token, max_age=max(0, bundle.refresh_expires_in))
    return response


@router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    uow: UnitOfWork = Depends(get_uow),
) -> LoginResponse:
    if not settings.auth_enable_legacy_password_login:
        raise Forbidden("Legacy authentication is disabled")

    async with uow:
        service = AuthSessionService(uow.users)
        session = await service.login(login=payload.login.strip(), password=payload.password.strip())

    clear_keycloak_refresh_cookie(response)
    clear_keycloak_state_cookie(response)
    set_refresh_cookie(response, session.refresh_token, max_age=max(0, session.refresh_token_expires_at - int(time.time())))
    return _build_legacy_auth_response(session=session, self_href="/api/v1/auth/login")


@router.post("/auth/refresh", response_model=LoginResponse)
async def refresh_session(
    request: Request,
    response: Response,
    uow: UnitOfWork = Depends(get_uow),
) -> LoginResponse:
    keycloak_refresh_token = (request.cookies.get(settings.keycloak_refresh_cookie_name) or "").strip()
    if settings.keycloak_enabled and keycloak_refresh_token:
        try:
            bundle = await refresh_tokens(refresh_token=keycloak_refresh_token)
        except Unauthorized:
            clear_keycloak_refresh_cookie(response)
        else:
            clear_refresh_cookie(response)
            set_keycloak_refresh_cookie(response, bundle.refresh_token, max_age=max(0, bundle.refresh_expires_in))
            async with uow:
                return await _build_keycloak_auth_response(
                    access_token=bundle.access_token,
                    self_href="/api/v1/auth/refresh",
                    uow=uow,
                )

    legacy_refresh_token = (request.cookies.get(settings.refresh_cookie_name) or "").strip()
    if not legacy_refresh_token:
        raise Unauthorized("Missing credentials")
    if not settings.auth_enable_legacy_password_login:
        raise Unauthorized("Missing credentials")

    claims = await decode_refresh_token(legacy_refresh_token)
    async with uow:
        service = AuthSessionService(uow.users)
        user = await service.get_user_for_refresh(user_id=claims.subject)
        refresh_fingerprint_source = getattr(user, "password_hash", None) or f"user:{user.id}"
        if claims.fingerprint != build_refresh_fingerprint(refresh_fingerprint_source):
            raise Unauthorized("Invalid token")
        session = await service.build_session_bundle(user=user, refresh_max_expires_at=claims.max_expires_at)

    clear_keycloak_refresh_cookie(response)
    set_refresh_cookie(response, session.refresh_token, max_age=max(0, session.refresh_token_expires_at - int(time.time())))
    return _build_legacy_auth_response(session=session, self_href="/api/v1/auth/refresh")


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response) -> Response:
    clear_keycloak_refresh_cookie(response)
    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/auth/tg/exchange")
async def tg_exchange_disabled() -> dict[str, str]:
    raise Forbidden("Прямой вход из Telegram отключен")


@router.post("/users/register", response_model=RegisterUserResponse)
async def register_user(
    payload: RegisterUserRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RegisterUserResponse:
    UserPolicy.ensure_can_register_user(current_user)
    async with uow:
        service = UserRegistrationService(uow.users, uow.profiles)
        user = await service.register_user(
            current_user,
            user_id=payload.login.strip(),
            password=payload.password.strip(),
            role_id=payload.role_id,
            id_parent=payload.id_parent.strip() if payload.id_parent else None,
            full_name=payload.full_name.strip() if payload.full_name else None,
            phone=payload.phone.strip() if payload.phone else None,
            mail=payload.mail.strip() if payload.mail else None,
        )
    return RegisterUserResponse(
        data={
            "user_id": user.id,
            "role_id": user.id_role,
            "status": user.status,
        },
        _links=LinkSet(
            self=Link(href=f"/api/v1/users/{user.id}", method="GET"),
        ),
    )
