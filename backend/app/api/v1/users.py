from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, Path, Query

from app.api.dependencies import get_current_user, get_uow
from app.core.config import settings
from app.core.uow import UnitOfWork
from app.domain.exceptions import Forbidden
from app.domain.policies import CurrentUser, UserPolicy
from app.schemas.links import Link, LinkSet
from app.schemas.users import (
    EconomistListData,
    EconomistListItemSchema,
    EconomistListResponse,
    MeData,
    MeResponse,
    RequestEconomistItemSchema,
    RequestEconomistListData,
    RequestEconomistListResponse,
    UpdateMyCompanyContactsRequest,
    UpdateMyCredentialsRequest,
    UpdateMyProfileRequest,
    UserListData,
    UserListItemSchema,
    UserListResponse,
    UserStatusUpdateData,
    UserStatusUpdateRequest,
    UserStatusUpdateResponse,
)
from app.services.users import UserQueryService, UserSelfService, UserStatusService

router = APIRouter()


def _status_management_links(current_user: CurrentUser) -> list[Link] | None:
    try:
        UserPolicy.can_update_user_status(current_user)
    except Forbidden:
        return None
    return [
        Link(href="/api/v1/users/{user_id}/status", method="PATCH"),
    ]


def _list_users_actions(current_user: CurrentUser) -> list[Link] | None:
    actions = [
        Link(href="/api/v1/users", method="GET"),
        Link(href="/api/v1/users/economists", method="GET"),
    ]
    try:
        UserPolicy.can_register_user(current_user)
        actions.append(Link(href="/api/v1/users/register", method="POST"))
    except Forbidden:
        pass

    status_actions = _status_management_links(current_user)
    if status_actions:
        actions.extend(status_actions)

    return actions


def _my_profile_actions(current_user: CurrentUser) -> list[Link]:
    actions = [
        Link(href="/api/v1/users/me", method="GET"),
        Link(href="/api/v1/users/me/credentials", method="PATCH"),
        Link(href="/api/v1/users/me/profile", method="PATCH"),
    ]
    if current_user.role_id == settings.contractor_role_id:
        actions.append(Link(href="/api/v1/users/me/company-contacts", method="PATCH"))
    return actions


@router.get("/users", response_model=UserListResponse)
@router.get("/users/", response_model=UserListResponse, include_in_schema=False)
async def list_users(
    role_id: int | None = Query(default=None, ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> UserListResponse:
    async with uow:
        service = UserQueryService(uow.users)
        users = await service.list_users(current_user=current_user, role_id=role_id)
    available_actions = _list_users_actions(current_user)
    return UserListResponse(
        data=UserListData(items=[UserListItemSchema(**asdict(item)) for item in users]),
        _links=LinkSet(
            self=Link(href="/api/v1/users", method="GET"),
            available_actions=available_actions,
        ),
    )


@router.get("/users/economists", response_model=EconomistListResponse)
@router.get("/users/economists/", response_model=EconomistListResponse, include_in_schema=False)
async def list_economists(
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> EconomistListResponse:
    async with uow:
        service = UserQueryService(uow.users)
        economists = await service.list_economists(current_user=current_user)

    return EconomistListResponse(
        data=EconomistListData(items=[EconomistListItemSchema(**asdict(item)) for item in economists]),
        _links=LinkSet(
            self=Link(href="/api/v1/users/economists", method="GET"),
            available_actions=_list_users_actions(current_user),
        ),
    )


@router.get("/users/me", response_model=MeResponse)
@router.get("/users/me/", response_model=MeResponse, include_in_schema=False)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> MeResponse:
    async with uow:
        service = UserQueryService(uow.users)
        me = await service.get_me(current_user)

    if current_user.role_id != settings.contractor_role_id:
        me = me.__class__(
            user_id=me.user_id,
            role_id=me.role_id,
            status=me.status,
            tg_user_id=me.tg_user_id,
            full_name=me.full_name,
            phone=me.phone,
            mail=me.mail,
        )

    return MeResponse(
        data=MeData(**asdict(me)),
        _links=LinkSet(
            self=Link(href="/api/v1/users/me", method="GET"),
            available_actions=_my_profile_actions(current_user),
        ),
    )


@router.patch("/users/me/credentials", response_model=MeResponse)
async def update_my_credentials(
    payload: UpdateMyCredentialsRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> MeResponse:
    async with uow:
        self_service = UserSelfService(uow.users, uow.profiles, uow.company_contacts)
        await self_service.update_my_credentials(
            current_user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )

        query_service = UserQueryService(uow.users)
        me = await query_service.get_me(current_user)

    if current_user.role_id != settings.contractor_role_id:
        me = me.__class__(
            user_id=me.user_id,
            role_id=me.role_id,
            status=me.status,
            tg_user_id=me.tg_user_id,
            full_name=me.full_name,
            phone=me.phone,
            mail=me.mail,
        )

    return MeResponse(
        data=MeData(**asdict(me)),
        _links=LinkSet(
            self=Link(href="/api/v1/users/me/credentials", method="PATCH"),
            available_actions=_my_profile_actions(current_user),
        ),
    )


@router.patch("/users/me/profile", response_model=MeResponse)
async def update_my_profile(
    payload: UpdateMyProfileRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> MeResponse:
    async with uow:
        self_service = UserSelfService(uow.users, uow.profiles, uow.company_contacts)
        await self_service.update_my_profile(
            current_user,
            full_name=payload.full_name,
            phone=payload.phone,
            mail=payload.mail,
        )

        query_service = UserQueryService(uow.users)
        me = await query_service.get_me(current_user)

    if current_user.role_id != settings.contractor_role_id:
        me = me.__class__(
            user_id=me.user_id,
            role_id=me.role_id,
            status=me.status,
            tg_user_id=me.tg_user_id,
            full_name=me.full_name,
            phone=me.phone,
            mail=me.mail,
        )

    return MeResponse(
        data=MeData(**asdict(me)),
        _links=LinkSet(
            self=Link(href="/api/v1/users/me/profile", method="PATCH"),
            available_actions=_my_profile_actions(current_user),
        ),
    )


@router.patch("/users/me/company-contacts", response_model=MeResponse)
async def update_my_company_contacts(
    payload: UpdateMyCompanyContactsRequest,
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> MeResponse:
    async with uow:
        self_service = UserSelfService(uow.users, uow.profiles, uow.company_contacts)
        await self_service.update_my_company_contacts(
            current_user,
            company_name=payload.company_name,
            inn=payload.inn,
            company_phone=payload.company_phone,
            company_mail=payload.company_mail,
            address=payload.address,
            note=payload.note,
        )

        query_service = UserQueryService(uow.users)
        me = await query_service.get_me(current_user)

    return MeResponse(
        data=MeData(**asdict(me)),
        _links=LinkSet(
            self=Link(href="/api/v1/users/me/company-contacts", method="PATCH"),
            available_actions=_my_profile_actions(current_user),
        ),
    )



@router.get("/users/request-economists", response_model=RequestEconomistListResponse)
@router.get("/users/request-economists/", response_model=RequestEconomistListResponse, include_in_schema=False)
async def list_request_economists(
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RequestEconomistListResponse:
    async with uow:
        service = UserQueryService(uow.users)
        users = await service.list_request_economists(current_user=current_user)

    actions = [
        Link(href="/api/v1/requests", method="GET"),
        Link(href="/api/v1/users/request-economists", method="GET"),
    ]
    try:
        UserPolicy.can_register_user(current_user)
        actions.append(Link(href="/api/v1/users/register", method="POST"))
    except Forbidden:
        pass
    try:
        UserPolicy.can_update_user_status(current_user)
        actions.append(Link(href="/api/v1/users/{user_id}/status", method="PATCH"))
    except Forbidden:
        pass

    return RequestEconomistListResponse(
        data=RequestEconomistListData(items=[RequestEconomistItemSchema(**asdict(item)) for item in users]),
        _links=LinkSet(
            self=Link(href="/api/v1/users/request-economists", method="GET"),
            available_actions=actions,
        ),
    )


@router.patch("/users/{user_id}/status", response_model=UserStatusUpdateResponse)
async def update_user_status(
    payload: UserStatusUpdateRequest,
    user_id: str = Path(...),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> UserStatusUpdateResponse:
    async with uow:
        service = UserStatusService(uow.users, uow.tg_users)
        result = await service.update_statuses(
            current_user=current_user,
            user_id=user_id,
            user_status=payload.user_status,
            tg_status=payload.tg_status,
        )

    return UserStatusUpdateResponse(
        data=UserStatusUpdateData(
            user_id=result.user_id,
            user_status=result.user_status,
            tg_user_id=result.tg_user_id,
            tg_status=result.tg_status,
        ),
        _links=LinkSet(
            self=Link(href=f"/api/v1/users/{result.user_id}/status", method="PATCH"),
            available_actions=_list_users_actions(current_user),
        ),
    )
