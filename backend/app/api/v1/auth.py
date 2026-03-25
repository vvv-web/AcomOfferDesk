from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Query, Request, Response, status
from pydantic import BaseModel, Field

from app.api.action_flags import serialize_permissions
from app.api.dependencies import get_current_user, get_uow
from app.api.v1.tg import resolve_tg_id_from_auth_token
from app.core.auth_cookies import clear_refresh_cookie, set_refresh_cookie
from app.core.config import settings
from app.core.session_tokens import build_refresh_fingerprint, decode_refresh_token
from app.core.uow import UnitOfWork
from app.domain.auth_context import build_current_user
from app.domain.exceptions import Forbidden, Unauthorized
from app.domain.policies import CurrentUser, UserPolicy
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterUserRequest,
    RegisterUserResponse,
    TgExchangeRequest,
)
from app.schemas.links import Link, LinkSet
from app.services.auth_session import AuthSessionBundle, AuthSessionService
from app.services.email_verification import EmailVerificationService
from app.services.users import UserRegistrationService

router = APIRouter()


class RequestEmailVerificationRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class EmailVerificationActionResponse(BaseModel):
    detail: str


def _build_auth_links(*, current_user: CurrentUser, self_href: str) -> LinkSet:
    return LinkSet(
        self=Link(href=self_href, method="POST"),
    )


def _build_auth_response(*, session: AuthSessionBundle, self_href: str) -> LoginResponse:
    current_user = build_current_user(
        user_id=session.user_id,
        role_id=session.role_id,
        status=session.status,
    )
    return LoginResponse(
        data={
            "access_token": session.access_token,
            "token_type": "bearer",
            "access_token_expires_at": session.access_token_expires_at,
            "user_id": session.user_id,
            "login": session.login,
            "role_id": session.role_id,
            "status": session.status,
            "permissions": serialize_permissions(current_user),
        },
        _links=_build_auth_links(current_user=current_user, self_href=self_href),
    )


@router.post("/auth/request-email-verification", response_model=EmailVerificationActionResponse)
async def request_email_verification(
    payload: RequestEmailVerificationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> EmailVerificationActionResponse:
    async with uow:
        service = EmailVerificationService(uow.profiles)
        status = await service.request_profile_verification(user_id=current_user.user_id, email=payload.email)

    if status == "same_email":
        return EmailVerificationActionResponse(detail="Указан текущий подтвержденный email")
    if status == "already_sent":
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


@router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    uow: UnitOfWork = Depends(get_uow),
) -> LoginResponse:
    async with uow:
        service = AuthSessionService(uow.users)
        session = await service.login(login=payload.login.strip(), password=payload.password.strip())

    set_refresh_cookie(response, session.refresh_token, max_age=max(0, session.refresh_token_expires_at - int(time.time())))
    return _build_auth_response(session=session, self_href="/api/v1/auth/login")


@router.post("/auth/refresh", response_model=LoginResponse)
async def refresh_session(
    request: Request,
    response: Response,
    uow: UnitOfWork = Depends(get_uow),
) -> LoginResponse:
    token = (request.cookies.get(settings.refresh_cookie_name) or "").strip()
    if not token:
        raise Unauthorized("Missing credentials")

    claims = await decode_refresh_token(token)

    async with uow:
        service = AuthSessionService(uow.users)
        user = await service.get_user_for_refresh(user_id=claims.subject)
        if claims.fingerprint != build_refresh_fingerprint(user.password_hash):
            raise Unauthorized("Invalid token")
        session = await service.build_session_bundle(user=user, refresh_max_expires_at=claims.max_expires_at)

    set_refresh_cookie(response, session.refresh_token, max_age=max(0, session.refresh_token_expires_at - int(time.time())))
    return _build_auth_response(session=session, self_href="/api/v1/auth/refresh")


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/auth/tg/exchange", response_model=LoginResponse)
async def tg_exchange(
    payload: TgExchangeRequest,
    response: Response,
    uow: UnitOfWork = Depends(get_uow),
) -> LoginResponse:
    tg_id = await resolve_tg_id_from_auth_token(payload.token)
    async with uow:
        tg_user = await uow.tg_users.get_by_id(tg_id)
        linked_user = await uow.users.get_by_tg_user_id(tg_id)
        if tg_user is None or linked_user is None:
            raise Forbidden("Invalid token")
        if linked_user.id_role != settings.contractor_role_id:
            raise Forbidden("Access denied")
        if tg_user.status != "approved" or linked_user.status != "active":
            raise Forbidden("Access denied")
        service = AuthSessionService(uow.users)
        session = await service.build_session_bundle(user=linked_user)

    set_refresh_cookie(response, session.refresh_token, max_age=max(0, session.refresh_token_expires_at - int(time.time())))
    return _build_auth_response(session=session, self_href="/api/v1/auth/tg/exchange")


@router.post("/users/register", response_model=RegisterUserResponse)
async def register_user(
    payload: RegisterUserRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RegisterUserResponse:
    UserPolicy.ensure_can_register_user(current_user)
    async with uow:
        service = UserRegistrationService(uow.users)
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
