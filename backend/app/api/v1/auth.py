from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user, get_uow
from app.core.uow import UnitOfWork
from app.domain.policies import CurrentUser, UserPolicy
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RegisterUserRequest,
    RegisterUserResponse,
)
from app.schemas.links import Link, LinkSet
from app.core.config import settings
from app.services.auth import AuthService
from app.services.users import UserRegistrationService
from app.services.email_verification import EmailVerificationService

router = APIRouter()


class RequestEmailVerificationRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class EmailVerificationActionResponse(BaseModel):
    detail: str


@router.post("/auth/request-email-verification", response_model=EmailVerificationActionResponse)
async def request_email_verification(
    payload: RequestEmailVerificationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> EmailVerificationActionResponse:
    async with uow:
        service = EmailVerificationService(uow.profiles)
        await service.request_profile_verification(user_id=current_user.user_id, email=payload.email)
    return EmailVerificationActionResponse(detail="Verification email sent")


@router.get("/auth/verify-email", response_model=EmailVerificationActionResponse)
async def verify_email(
    token: str = Query(..., min_length=20),
    uow: UnitOfWork = Depends(get_uow),
) -> EmailVerificationActionResponse:
    async with uow:
        service = EmailVerificationService(uow.profiles)
        updated = await service.confirm_profile_verification(token=token)

    if updated:
        return EmailVerificationActionResponse(detail="Email verified")
    return EmailVerificationActionResponse(detail="Email already verified")


@router.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest, uow: UnitOfWork = Depends(get_uow)) -> LoginResponse:
    async with uow:
        service = AuthService(uow.users)
        token, role_id = await service.login(payload.login.strip(), payload.password.strip())
    links = LinkSet(
        self=Link(href="/api/v1/auth/login", method="POST"),
    )
    if role_id == settings.superadmin_role_id:
        links.available_actions = [
            Link(href="/api/v1/users/register", method="POST"),
            Link(href="/api/v1/users", method="GET"),
            Link(href="/api/v1/users/economists", method="GET"),
            Link(href="/api/v1/users/{user_id}/status", method="PATCH"),
            Link(href="/api/v1/users/{user_id}/role", method="PATCH"),
            Link(href="/api/v1/requests", method="GET"),
            Link(href="/api/v1/requests", method="POST"),
            Link(href="/api/v1/requests/open", method="GET"),
            Link(href="/api/v1/requests/{request_id}", method="GET"),
            Link(href="/api/v1/requests/{request_id}", method="PATCH"),
            Link(href="/api/v1/requests/{request_id}/files", method="POST"),
            Link(href="/api/v1/requests/{request_id}/files/{file_id}", method="DELETE"),
            Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/status", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/attachments", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/received", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages/read", method="PATCH"),
            Link(href="/api/v1/requests/deleted-alerts/viewed", method="PATCH"),
            Link(href="/api/v1/files/{file_id}/download", method="GET"),
            Link(href="/api/v1/feedback", method="POST"),
            Link(href="/api/v1/feedback", method="GET"),
        ]
    elif role_id == settings.admin_role_id:
        links.available_actions = [
            Link(href="/api/v1/users/register", method="POST"),
            Link(href="/api/v1/users", method="GET"),
            Link(href="/api/v1/users/economists", method="GET"),
            Link(href="/api/v1/users/{user_id}/status", method="PATCH"),
            Link(href="/api/v1/users/{user_id}/role", method="PATCH"),
            Link(href="/api/v1/feedback", method="POST"),
        ]
    elif role_id in {settings.lead_economist_role_id, settings.project_manager_role_id}:
        links.available_actions = [
            Link(href="/api/v1/users", method="GET"),
            Link(href="/api/v1/users/economists", method="GET"),
            Link(href="/api/v1/users/register", method="POST"),
            Link(href="/api/v1/users/{user_id}/status", method="PATCH"),
            Link(href="/api/v1/requests", method="GET"),
            Link(href="/api/v1/requests", method="POST"),
            Link(href="/api/v1/requests/open", method="GET"),
            Link(href="/api/v1/requests/{request_id}", method="GET"),
            Link(href="/api/v1/requests/{request_id}", method="PATCH"),
            Link(href="/api/v1/requests/{request_id}/files", method="POST"),
            Link(href="/api/v1/requests/{request_id}/files/{file_id}", method="DELETE"),
            Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/status", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/attachments", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/received", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages/read", method="PATCH"),
            Link(href="/api/v1/requests/deleted-alerts/viewed", method="PATCH"),
            Link(href="/api/v1/files/{file_id}/download", method="GET"),
            Link(href="/api/v1/feedback", method="POST"),
        ]
    elif role_id == settings.economist_role_id:
        links.available_actions = [
            Link(href="/api/v1/requests", method="GET"),
            Link(href="/api/v1/requests", method="POST"),
            Link(href="/api/v1/requests/open", method="GET"),
            Link(href="/api/v1/requests/{request_id}", method="GET"),
            Link(href="/api/v1/requests/{request_id}", method="PATCH"),
            Link(href="/api/v1/requests/{request_id}/files", method="POST"),
            Link(href="/api/v1/requests/{request_id}/files/{file_id}", method="DELETE"),
            Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/status", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/attachments", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/received", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages/read", method="PATCH"),
            Link(href="/api/v1/requests/deleted-alerts/viewed", method="PATCH"),
            Link(href="/api/v1/files/{file_id}/download", method="GET"),
            Link(href="/api/v1/feedback", method="POST"),
        ]
    elif role_id == settings.contractor_role_id:
        links.available_actions = [
            Link(href="/api/v1/requests/open", method="GET"),
            Link(href="/api/v1/requests/offered", method="GET"),
            Link(href="/api/v1/requests/{request_id}/contractor-view", method="GET"),
            Link(href="/api/v1/requests/{request_id}/offers", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/files", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/files/{file_id}", method="DELETE"),
            Link(href="/api/v1/offers/{offer_id}/status", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/attachments", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/received", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages/read", method="PATCH"),
            Link(href="/api/v1/files/{file_id}/download", method="GET"),
            Link(href="/api/v1/feedback", method="POST"),
        ]
    elif role_id == settings.operator_role_id:
        links.available_actions = [
            Link(href="/api/v1/requests", method="GET"),
            Link(href="/api/v1/requests", method="POST"),
            Link(href="/api/v1/requests/{request_id}", method="GET"),
            Link(href="/api/v1/requests/{request_id}", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="GET"),
            Link(href="/api/v1/files/{file_id}/download", method="GET"),
            Link(href="/api/v1/feedback", method="POST"),
        ]
    return LoginResponse(
        data={
            "access_token": token,
            "token_type": "bearer",
            "role_id": role_id,
        },
        _links=links,
    )


@router.post("/users/register", response_model=RegisterUserResponse)
async def register_user(
    payload: RegisterUserRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RegisterUserResponse:
    UserPolicy.can_register_user(current_user)
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
            available_actions=[
                Link(href="/api/v1/auth/login", method="POST"),
                Link(href="/api/v1/users", method="GET"),
            ],
        ),
    )