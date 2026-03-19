from __future__ import annotations

import io
import os
import zipfile
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import anyio
from fastapi import APIRouter, Body, Depends, File, Form, Path as PathParam, UploadFile
from fastapi.responses import FileResponse

from app.api.dependencies import get_current_user, get_uow
from app.core.config import settings
from app.core.uow import UnitOfWork
from app.domain.exceptions import Conflict, Forbidden, NotFound
from app.domain.policies import CurrentUser, RequestPolicy, UserPolicy
from app.schemas.links import Link, LinkSet
from app.schemas.requests import (
    OfferItemSchema,
    OfferedRequestOfferSchema,
    OpenRequestItemSchema,
    OpenRequestListData,
    OpenRequestListResponse,
    RequestCreateResponse,
    RequestDetailsResponse,
    RequestDetailsResponseData,
    RequestDetailsSchema,
    DeletedAlertViewed,
    DeletedAlertViewedResponse,
    RequestEditPayload,
    RequestFileMutationResponse,
    RequestFileSchema,
    RequestItemSchema,
    RequestListData,
    RequestListResponse,
    RequestMutationResponse,
    RequestOfferStatsSchema,
    RequestStatsSchema,
)
from app.services.requests import RequestEditInput, RequestFileCreateInput, RequestService
from app.services.email_notifications import EmailNotificationService

router = APIRouter()

_ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".txt",
    ".md",
    ".doc",
    ".docx",
    ".docs",
    ".xls",
    ".xlsx",
    ".exl",
    ".csv",
    ".ods",
}
_DANGEROUS_EXTENSIONS = {".exe", ".sh", ".bat", ".cmd", ".ps1", ".js", ".msi", ".dll", ".so", ".jar"}
_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


def _is_zip_based_office_document(*, content: bytes, required_entry: str) -> bool:
    if not content.startswith(b"PK\x03\x04"):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = set(archive.namelist())
            return required_entry in names
    except zipfile.BadZipFile:
        return False


def _magic_signature_matches(*, extension: str, content: bytes) -> bool:
    if extension == ".pdf":
        return content.startswith(b"%PDF-")
    if extension == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if extension in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")
    if extension in {".txt", ".md", ".csv"}:
        try:
            content.decode("utf-8")
        except UnicodeDecodeError:
            return False
        return True
    if extension in {".doc", ".docs", ".xls", ".exl"}:
        return content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
    if extension == ".docx":
        return _is_zip_based_office_document(content=content, required_entry="word/document.xml")
    if extension == ".xlsx":
        return _is_zip_based_office_document(content=content, required_entry="xl/workbook.xml")
    if extension == ".ods":
        if not content.startswith(b"PK\x03\x04"):
            return False
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
                if "mimetype" in names:
                    mimetype = archive.read("mimetype")
                    if mimetype == b"application/vnd.oasis.opendocument.spreadsheet":
                        return True
                return "content.xml" in names
        except (zipfile.BadZipFile, KeyError):
            return False
    return False


def _sanitize_filename(filename: str) -> str:
    basename = Path(filename).name.strip()
    if not basename:
        raise Conflict("File name is required")
    if basename != filename.strip():
        raise Conflict("Unsafe file name")
    return basename


async def _validate_upload(file: UploadFile) -> tuple[str, bytes]:
    filename = _sanitize_filename(file.filename or "")
    extension = Path(filename).suffix.lower()

    if extension in _DANGEROUS_EXTENSIONS:
        raise Conflict("Forbidden file type")
    if extension not in _ALLOWED_EXTENSIONS:
        raise Conflict("Unsupported file extension")

    content = await file.read()
    if not content:
        raise Conflict("File cannot be empty")
    if len(content) > _MAX_FILE_SIZE_BYTES:
        raise Conflict("File too large")
    if not _magic_signature_matches(extension=extension, content=content):
        raise Conflict("File content does not match extension")

    return filename, content

def _request_actions(current_user: CurrentUser) -> list[Link] | None:
    try:
        UserPolicy.can_view_requests(current_user)
    except Forbidden:
        return None
    actions = [
        Link(href="/api/v1/requests", method="GET"),
        Link(href="/api/v1/requests/{request_id}", method="GET"),
        Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
        Link(href="/api/v1/offers/{offer_id}/messages", method="GET"),
        Link(href="/api/v1/files/{file_id}/download", method="GET"),
    ]
    try:
        UserPolicy.can_create_request(current_user)
        actions.append(Link(href="/api/v1/requests", method="POST"))
    except Forbidden:
        pass

    try:
        UserPolicy.can_manage_requests(current_user)
    except Forbidden:
        if current_user.role_id == settings.operator_role_id:
            actions.extend(
                [
                    Link(href="/api/v1/requests/{request_id}", method="PATCH"),
                    Link(href="/api/v1/requests/{request_id}/files", method="POST"),
                    Link(href="/api/v1/requests/{request_id}/files/{file_id}", method="DELETE"),
                ]
            )
        return actions

    actions.extend(
        [
            Link(href="/api/v1/requests/{request_id}", method="PATCH"),
            Link(href="/api/v1/requests/{request_id}/files", method="POST"),
            Link(href="/api/v1/requests/{request_id}/files/{file_id}", method="DELETE"),
            Link(href="/api/v1/requests/deleted-alerts/viewed", method="PATCH"),
        ]
    )

    return actions

def _open_request_actions(current_user: CurrentUser) -> list[Link] | None:
    try:
        UserPolicy.can_view_open_requests(current_user)
    except Forbidden:
        return None
    actions = [
        Link(href="/api/v1/requests/open", method="GET"),
        Link(href="/api/v1/requests/offered", method="GET"),
        Link(href="/api/v1/files/{file_id}/download", method="GET"),
    ]
    try:
        UserPolicy.can_create_offer(current_user)
    except Forbidden:
        return actions

    actions.extend(
        [
            Link(href="/api/v1/requests/{request_id}/contractor-view", method="GET"),
            Link(href="/api/v1/requests/{request_id}/offers", method="POST"),
        ]
    )
    return actions

def _offered_request_actions(current_user: CurrentUser) -> list[Link] | None:
    try:
        UserPolicy.can_view_offered_requests(current_user)
    except Forbidden:
        return None
    return [
        Link(href="/api/v1/requests/offered", method="GET"),
        Link(href="/api/v1/requests/{request_id}/contractor-view", method="GET"),
        Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
        Link(href="/api/v1/files/{file_id}/download", method="GET"),
    ]


def _request_detail_actions(current_user: CurrentUser, *, request_id: int, owner_user_id: str) -> list[Link] | None:
    actions = [
        Link(href="/api/v1/requests", method="GET"),
        Link(href=f"/api/v1/requests/{request_id}", method="GET"),
        Link(href="/api/v1/offers/{offer_id}/workspace", method="GET"),
        Link(href="/api/v1/offers/{offer_id}/messages", method="GET"),
        Link(href="/api/v1/files/{file_id}/download", method="GET"),
    ]

    try:
        RequestPolicy.can_edit_owned_unassigned(current_user, request_owner_user_id=owner_user_id)
        actions.extend(
            [
                Link(href=f"/api/v1/requests/{request_id}", method="PATCH"),
                Link(href=f"/api/v1/requests/{request_id}/files", method="POST"),
                Link(href=f"/api/v1/requests/{request_id}/files/{{file_id}}", method="DELETE"),
            ]
        )
    except Forbidden:
        return actions

    try:
        RequestPolicy.can_edit(current_user, request_owner_user_id=owner_user_id)
    except Forbidden:
        return actions

    actions.extend(
        [
            Link(href="/api/v1/offers/{offer_id}/status", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/attachments", method="POST"),
            Link(href="/api/v1/offers/{offer_id}/messages/received", method="PATCH"),
            Link(href="/api/v1/offers/{offer_id}/messages/read", method="PATCH"),
        ]
    )

    return actions


@router.get("/requests", response_model=RequestListResponse)
@router.get("/requests/", response_model=RequestListResponse, include_in_schema=False)
async def list_requests(
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RequestListResponse:
    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        items = await service.list_requests(current_user=current_user)

    return RequestListResponse(
        data=RequestListData(
            items=[
                RequestItemSchema(
                    request_id=item.request_id,
                    description=item.description,
                    status=item.status,
                    status_label=item.status_label,
                    deadline_at=item.deadline_at,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    closed_at=item.closed_at,
                    owner_user_id=item.owner_user_id,
                    owner_full_name=item.owner_full_name,
                    chosen_offer_id=item.chosen_offer_id,
                    stats=RequestStatsSchema(
                        count_submitted=item.count_submitted,
                        count_deleted_alert=item.count_deleted_alert,
                        count_accepted_total=item.count_accepted_total,
                        count_rejected_total=item.count_rejected_total,
                    ),
                    unread_messages_count=item.unread_messages_count,
                    files=[
                        RequestFileSchema(
                            id=f.id,
                            path=f.path,
                            name=f.name,
                            download_url=f"/api/v1/files/{f.id}/download",
                        )
                        for f in item.files
                    ],
                )
                for item in items
            ]
        ),
        _links=LinkSet(
            self=Link(href="/api/v1/requests", method="GET"),
            available_actions=_request_actions(current_user),
        ),
    )

@router.get("/requests/open", response_model=OpenRequestListResponse)
@router.get("/requests/open/", response_model=OpenRequestListResponse, include_in_schema=False)
async def list_open_requests(
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OpenRequestListResponse:
    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        if current_user.role_id == settings.contractor_role_id:
            items = await service.list_open_requests_for_contractor(current_user=current_user)
        else:
            items = await service.list_open_requests(current_user=current_user)

    return OpenRequestListResponse(
        data=OpenRequestListData(
            items=[
                OpenRequestItemSchema(
                    request_id=item.request_id,
                    description=item.description,
                    status=item.status,
                    status_label=item.status_label,
                    deadline_at=item.deadline_at,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    closed_at=item.closed_at,
                    owner_user_id=item.owner_user_id,
                    owner_full_name=item.owner_full_name,
                    chosen_offer_id=(None if current_user.role_id == settings.contractor_role_id else item.chosen_offer_id),
                    files=[
                        RequestFileSchema(
                            id=f.id,
                            path=f.path,
                            name=f.name,
                            download_url=f"/api/v1/files/{f.id}/download",
                        )
                        for f in item.files
                    ],
                )
                for item in items
            ]
        ),
        _links=LinkSet(
            self=Link(href="/api/v1/requests/open", method="GET"),
            available_actions=_open_request_actions(current_user),
        ),
    )

@router.get("/requests/offered", response_model=OpenRequestListResponse)
@router.get("/requests/offered/", response_model=OpenRequestListResponse, include_in_schema=False)
async def list_offered_requests(
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OpenRequestListResponse:
    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        items = await service.list_offered_requests_for_contractor(current_user=current_user)

    return OpenRequestListResponse(
        data=OpenRequestListData(
            items=[
                OpenRequestItemSchema(
                    request_id=item.request_id,
                    description=item.description,
                    status=item.status,
                    status_label=item.status_label,
                    deadline_at=item.deadline_at,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    closed_at=item.closed_at,
                    owner_user_id=item.owner_user_id,
                    owner_full_name=item.owner_full_name,
                    chosen_offer_id=None,
                    files=[
                        RequestFileSchema(
                            id=f.id,
                            path=f.path,
                            name=f.name,
                            download_url=f"/api/v1/files/{f.id}/download",
                        )
                        for f in item.files
                    ],
                    offers=[
                        OfferedRequestOfferSchema(
                            offer_id=offer.offer_id,
                            status=offer.status,
                            unread_messages_count=offer.unread_messages_count,
                        )
                        for offer in item.offers
                    ],
                )
                for item in items
            ]
        ),
        _links=LinkSet(
            self=Link(href="/api/v1/requests/offered", method="GET"),
            available_actions=_offered_request_actions(current_user),
        ),
    )

@router.get("/requests/{request_id}", response_model=RequestDetailsResponse)
@router.get("/requests/{request_id}/", response_model=RequestDetailsResponse, include_in_schema=False)
async def get_request_details(
    request_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RequestDetailsResponse:
    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        item = await service.get_request_details(current_user=current_user, request_id=request_id)

    return RequestDetailsResponse(
        data=RequestDetailsResponseData(
            item=RequestDetailsSchema(
                request_id=item.request_id,
                description=item.description,
                status=item.status,
                status_label=item.status_label,
                deadline_at=item.deadline_at,
                created_at=item.created_at,
                updated_at=item.updated_at,
                closed_at=item.closed_at,
                owner_user_id=item.owner_user_id,
                owner_full_name=item.owner_full_name,
                chosen_offer_id=item.chosen_offer_id,
                stats=RequestStatsSchema(
                    count_submitted=item.count_submitted,
                    count_deleted_alert=item.count_deleted_alert,
                    count_accepted_total=item.count_accepted_total,
                    count_rejected_total=item.count_rejected_total,
                ),
                unread_messages_count=item.unread_messages_count,
                files=[
                    RequestFileSchema(
                        id=f.id,
                        path=f.path,
                        name=f.name,
                        download_url=f"/api/v1/files/{f.id}/download",
                    )
                    for f in item.files
                ],
                offers=[
                    OfferItemSchema(
                        offer_id=offer.offer_id,
                        contractor_user_id=offer.contractor_user_id,
                        status=offer.status,
                        status_label=offer.status_label,
                        created_at=offer.created_at,
                        updated_at=offer.updated_at,
                        offer_workspace_url=offer.offer_workspace_url,
                        contractor_full_name=offer.contractor_full_name,                        
                        contractor_phone=offer.contractor_phone,
                        contractor_mail=offer.contractor_mail,
                        contractor_inn=offer.contractor_inn,
                        contractor_company_name=offer.contractor_company_name,
                        contractor_company_phone=offer.contractor_company_phone,
                        contractor_company_mail=offer.contractor_company_mail,
                        contractor_contact_phone=offer.contractor_contact_phone,
                        contractor_contact_mail=offer.contractor_contact_mail,
                        contractor_address=offer.contractor_address,
                        contractor_note=offer.contractor_note,
                        files=[
                            RequestFileSchema(
                                id=f.id,
                                path=f.path,
                                name=f.name,
                                download_url=f"/api/v1/files/{f.id}/download",
                            )
                            for f in offer.files
                        ],
                        unread_messages_count=offer.unread_messages_count,
                    )
                    for offer in item.offers
                ],
            )
        ),
        _links=LinkSet(
            self=Link(href=f"/api/v1/requests/{request_id}", method="GET"),
            available_actions=_request_detail_actions(
                current_user,
                request_id=request_id,
                owner_user_id=item.owner_user_id,
            ),
        ),
    )


@router.post("/requests", response_model=RequestCreateResponse)
async def create_request(
    deadline_at: datetime = Form(...),
    description: str | None = Form(default=None),
    additional_emails: list[str] | None = Form(default=None),
    hidden_contractor_ids: list[str] | None = Form(default=None),
    files: list[UploadFile] = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RequestCreateResponse:
    if not files:
        raise Conflict("At least one file is required")

    relative_dir = Path("uploads")
    await anyio.Path(relative_dir).mkdir(parents=True, exist_ok=True)

    file_inputs: list[RequestFileCreateInput] = []
    for file in files:
        safe_name, content = await _validate_upload(file)

        ext = os.path.splitext(safe_name)[1]
        generated_name = f"{uuid4().hex}{ext}"
        relative_path = relative_dir / generated_name
        await anyio.Path(relative_path).write_bytes(content)
        file_inputs.append(RequestFileCreateInput(path=str(relative_path), name=safe_name))

    async with uow:
        email_notifications = EmailNotificationService(uow.profiles, uow.requests)
        service = RequestService(
            uow.requests,
            uow.files,
            uow.users,
            uow.offers,
            uow.user_status_periods,
            email_notifications=email_notifications,
        )
        request_id, file_ids = await service.create_request(
            current_user=current_user,
            deadline_at=deadline_at,
            description=description,
            files=file_inputs,
            additional_emails=additional_emails,
            hidden_contractor_ids=hidden_contractor_ids,
        )

    return RequestCreateResponse(
        data={"request_id": request_id, "file_ids": file_ids},
        _links=LinkSet(
            self=Link(href=f"/api/v1/requests/{request_id}", method="GET"),
            available_actions=_request_actions(current_user),
        ),
    )


@router.patch("/requests/{request_id}", response_model=RequestMutationResponse)
async def update_request(
    payload: RequestEditPayload = Body(...),
    request_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RequestMutationResponse:
    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        await service.update_request(
            current_user=current_user,
            request_id=request_id,
            data=RequestEditInput(
                status=payload.status,
                deadline_at=payload.deadline_at,
                owner_user_id=payload.owner_user_id,
            ),
        )

    return RequestMutationResponse(
        data={"request_id": request_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/requests/{request_id}", method="GET"),
            available_actions=_request_actions(current_user),
        ),
    )


@router.post("/requests/{request_id}/files", response_model=RequestFileMutationResponse)
async def add_request_file(
    request_id: int = PathParam(..., ge=1),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RequestFileMutationResponse:
    safe_name, content = await _validate_upload(file)

    relative_dir = Path("uploads")
    await anyio.Path(relative_dir).mkdir(parents=True, exist_ok=True)
    ext = os.path.splitext(safe_name)[1]
    generated_name = f"{uuid4().hex}{ext}"
    relative_path = relative_dir / generated_name
    await anyio.Path(relative_path).write_bytes(content)

    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        file_id = await service.attach_file(
            current_user=current_user,
            request_id=request_id,
            file_data=RequestFileCreateInput(path=str(relative_path), name=safe_name),
        )

    return RequestFileMutationResponse(
        data={"request_id": request_id, "file_id": file_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/requests/{request_id}", method="GET"),
            available_actions=_request_actions(current_user),
        ),
    )


@router.delete("/requests/{request_id}/files/{file_id}", response_model=RequestFileMutationResponse)
async def delete_request_file(
    request_id: int = PathParam(..., ge=1),
    file_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> RequestFileMutationResponse:
    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        await service.remove_file(
            current_user=current_user,
            request_id=request_id,
            file_id=file_id,
        )

    return RequestFileMutationResponse(
        data={"request_id": request_id, "file_id": file_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/requests/{request_id}", method="GET"),
            available_actions=_request_actions(current_user),
        ),
    )


@router.patch("/requests/deleted-alerts/viewed", response_model=DeletedAlertViewedResponse)
async def mark_deleted_alert_viewed(
    payload: DeletedAlertViewed = Body(...),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> DeletedAlertViewedResponse:
    async with uow:
        service = RequestService(uow.requests, uow.files, uow.users, uow.offers, uow.user_status_periods)
        updated_stats = await service.mark_deleted_alert_viewed(
            current_user=current_user,
            request_id=payload.request_id,
        )

    return DeletedAlertViewedResponse(
        data={
            "status": "ok",
            "request_offer_stats": RequestOfferStatsSchema(
                request_id=updated_stats.request_id,
                count_deleted_alert=updated_stats.count_deleted_alert,
                updated_at=updated_stats.updated_at,
            ),
        },
        _links=LinkSet(
            self=Link(href="/api/v1/requests/deleted-alerts/viewed", method="PATCH"),
            available_actions=_request_actions(current_user),
        ),
    )


@router.get("/files/{file_id}/download")
@router.get("/files/{file_id}/download/", include_in_schema=False)
async def download_file(
    file_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> FileResponse:
    can_download = False
    try:
        UserPolicy.can_view_requests(current_user)
        can_download = True
    except Forbidden:
        UserPolicy.can_create_offer(current_user)

    async with uow:
        db_file = await uow.files.get_by_id(file_id)
        if db_file is None:
            raise NotFound("File not found")

        if not can_download:
            linked_to_open_request = await uow.requests.is_file_linked_to_visible_open_request(
                contractor_user_id=current_user.user_id,
                file_id=file_id,
            )
            linked_to_own_offer = await uow.offers.is_file_linked_to_contractor(
                contractor_user_id=current_user.user_id,
                file_id=file_id,
            )
            linked_to_own_message = await uow.offers.is_message_file_linked_to_contractor(
                contractor_user_id=current_user.user_id,
                file_id=file_id,
            )
            if not linked_to_open_request and not linked_to_own_offer and not linked_to_own_message:
                raise Forbidden("Insufficient permissions for file download")

    file_path = Path(db_file.path)
    if not file_path.exists() or not file_path.is_file():
        raise NotFound("File content not found")

    return FileResponse(path=file_path, filename=db_file.name, media_type="application/octet-stream")
