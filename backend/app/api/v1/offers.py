from __future__ import annotations

import io
import zipfile
from pathlib import Path
from uuid import uuid4

import anyio
from fastapi import APIRouter, Body, Depends, File, Form, Path as PathParam, Query, UploadFile

from app.api.available_actions import ApiAction, action, build_available_actions
from app.api.dependencies import get_current_user, get_uow
from app.core.config import settings
from app.core.uow import UnitOfWork
from app.domain.exceptions import Conflict, Forbidden, NotFound
from app.domain.policies import CurrentUser, OfferPolicy, RequestPolicy
from app.schemas.links import Link, LinkSet
from app.schemas.offers import (
    ContractorInfoResponse,
    ContractorRequestViewResponse,
    OfferCreateResponse,
    OfferCreatePayload,
    OfferEditPayload,
    OfferEditResponse,
    OfferFileMutationResponse,
    OfferMessageCreatePayload,
    OfferMessageCreateResponse,
    OfferMessageFileUploadResponse,
    OfferMessageListData,
    OfferMessageReadBySchema,
    OfferMessageListResponse,
    OfferMessageSchema,
    OfferMessageStatusUpdatePayload,
    OfferMessageStatusUpdateResponse,
    OfferStatusMutationResponse,
    OfferStatusUpdatePayload,
    OfferWorkspaceResponse,
)
from app.schemas.requests import RequestFileSchema
from app.realtime.contracts import OutboundEnvelope
from app.realtime.runtime import get_chat_runtime
from app.services.chat_realtime import ChatRealtimeService, build_offer_service
from app.services.files import FileService
from app.services.offers import AttachmentFileInput

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
_MAX_ATTACHMENTS_PER_MESSAGE = 5
_MAX_TOTAL_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024

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


async def _validate_and_store_upload(file: UploadFile) -> tuple[str, str, int]:
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

    relative_dir = Path("uploads")
    await anyio.Path(relative_dir).mkdir(parents=True, exist_ok=True)
    generated_name = f"{uuid4().hex}{extension}"
    relative_path = relative_dir / generated_name
    await anyio.Path(relative_path).write_bytes(content)
    return str(relative_path), filename, len(content)


def _contractor_request_actions(
    *,
    request_id: int,
    workspace_offer_id: int | None,
    current_user: CurrentUser,
    can_create_offer: bool,
) -> list[Link]:
    return build_available_actions(
        current_user,
        action(ApiAction.REQUESTS_OPEN_LIST),
        action(ApiAction.REQUESTS_OFFERED_LIST),
        action(ApiAction.REQUESTS_CONTRACTOR_VIEW, params={"request_id": request_id}),
        action(ApiAction.FILES_DOWNLOAD),
        action(
            ApiAction.OFFERS_WORKSPACE_GET,
            params={"offer_id": workspace_offer_id},
            enabled=workspace_offer_id is not None,
        ),
        action(
            ApiAction.OFFERS_CREATE,
            params={"request_id": request_id},
            enabled=can_create_offer,
        ),
    ) or []


def _ensure_offer_mutation_allowed(
    current_user: CurrentUser,
    *,
    offer_owner_user_id: str,
    request_owner_user_id: str,
) -> None:
    try:
        RequestPolicy.can_edit(current_user, request_owner_user_id=request_owner_user_id)
    except Forbidden:
        OfferPolicy.can_access_contractor_offer(current_user, offer_owner_user_id=offer_owner_user_id)


def _offer_workspace_actions(
    *,
    offer_id: int,
    request_id: int,
    current_user: CurrentUser,
    offer_owner_user_id: str,
    request_owner_user_id: str,
    can_create_new_offer: bool,
    can_acknowledge_messages: bool,
) -> list[Link]:
    return build_available_actions(
        current_user,
        action(ApiAction.OFFERS_WORKSPACE_GET, params={"offer_id": offer_id}),
        action(ApiAction.OFFER_MESSAGES_LIST, params={"offer_id": offer_id}),
        action(ApiAction.FILES_DOWNLOAD),
        action(ApiAction.REQUESTS_OFFERED_LIST, enabled=current_user.role_id == settings.contractor_role_id),
        action(
            ApiAction.OFFERS_FILES_ADD,
            params={"offer_id": offer_id},
            guard=lambda: OfferPolicy.can_access_contractor_offer(current_user, offer_owner_user_id=offer_owner_user_id),
        ),
        action(
            ApiAction.OFFERS_FILES_DELETE,
            params={"offer_id": offer_id},
            guard=lambda: OfferPolicy.can_access_contractor_offer(current_user, offer_owner_user_id=offer_owner_user_id),
        ),
        action(
            ApiAction.OFFERS_UPDATE,
            params={"offer_id": offer_id},
            guard=lambda: _ensure_offer_mutation_allowed(
                current_user,
                offer_owner_user_id=offer_owner_user_id,
                request_owner_user_id=request_owner_user_id,
            ),
        ),
        action(
            ApiAction.OFFERS_STATUS_UPDATE,
            params={"offer_id": offer_id},
            guard=lambda: _ensure_offer_mutation_allowed(
                current_user,
                offer_owner_user_id=offer_owner_user_id,
                request_owner_user_id=request_owner_user_id,
            ),
        ),
        action(
            ApiAction.OFFER_MESSAGES_CREATE,
            params={"offer_id": offer_id},
            guard=lambda: OfferPolicy.can_send_chat_message(
                current_user,
                offer_owner_user_id=offer_owner_user_id,
                request_owner_user_id=request_owner_user_id,
            ),
        ),
        action(
            ApiAction.OFFER_MESSAGE_FILES_UPLOAD,
            params={"offer_id": offer_id},
            guard=lambda: OfferPolicy.can_send_chat_message(
                current_user,
                offer_owner_user_id=offer_owner_user_id,
                request_owner_user_id=request_owner_user_id,
            ),
        ),
        action(
            ApiAction.OFFER_MESSAGE_ATTACHMENTS_CREATE,
            params={"offer_id": offer_id},
            guard=lambda: OfferPolicy.can_send_chat_message(
                current_user,
                offer_owner_user_id=offer_owner_user_id,
                request_owner_user_id=request_owner_user_id,
            ),
        ),
        action(
            ApiAction.OFFER_MESSAGES_RECEIVED,
            params={"offer_id": offer_id},
            enabled=can_acknowledge_messages,
        ),
        action(
            ApiAction.OFFER_MESSAGES_READ,
            params={"offer_id": offer_id},
            enabled=can_acknowledge_messages,
        ),
        action(
            ApiAction.OFFERS_CREATE,
            params={"request_id": request_id},
            enabled=can_create_new_offer,
        ),
    ) or []


async def _resolve_offer_action_links(
    *,
    offer_id: int,
    current_user: CurrentUser,
    uow: UnitOfWork,
) -> list[Link]:
    offer = await uow.offers.get_by_id(offer_id=offer_id)
    if offer is None:
        raise NotFound("Offer not found")

    request = await uow.requests.get_by_id(request_id=offer.id_request)
    if request is None:
        raise NotFound("Request not found")
    
    can_create_new_offer = False
    if current_user.role_id == settings.contractor_role_id and current_user.user_id == offer.id_user:
        latest_offer = await uow.offers.get_contractor_offer_for_request(
            request_id=request.id,
            contractor_user_id=current_user.user_id,
        )
        can_create_new_offer = (
            request.status == "open"
            and (latest_offer is None or latest_offer.status == "deleted")
        )

    can_acknowledge_messages = False
    chat = await uow.offers.get_chat(offer_id=offer.id)
    if chat is not None:
        participant = await uow.chats.get_active_participant(chat_id=chat.id, user_id=current_user.user_id)
        can_acknowledge_messages = participant is not None

    return _offer_workspace_actions(
        offer_id=offer_id,
        request_id=request.id,
        current_user=current_user,
        offer_owner_user_id=offer.id_user,
        request_owner_user_id=request.id_user,
        can_create_new_offer=can_create_new_offer,
        can_acknowledge_messages=can_acknowledge_messages,
    )


async def _build_offer_list_item_links(*, current_user: CurrentUser, offer_id: int, uow: UnitOfWork) -> list[Link]:
    return await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

@router.get("/offers", response_model=ContractorInfoResponse)
async def get_contractor_info(
    id_user: str = Query(..., min_length=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> ContractorInfoResponse:
    async with uow:
        service = build_offer_service(uow)
        contractor = await service.get_contractor_info(current_user=current_user, contractor_user_id=id_user)

    return ContractorInfoResponse(
        data={
            "user_id": contractor.user_id,
            "full_name": contractor.full_name,
            "phone": contractor.phone,
            "mail": contractor.mail,
            "company_name": contractor.company_name,
            "inn": contractor.inn,
            "company_phone": contractor.company_phone,
            "company_mail": contractor.company_mail,
            "address": contractor.address,
            "note": contractor.note,
        },
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers?id_user={contractor.user_id}", method="GET"),
            available_actions=build_available_actions(
                current_user,
                action(ApiAction.REQUESTS_GET),
                action(ApiAction.REQUESTS_OFFERED_LIST),
            ),
        ),
    )

@router.get("/requests/{request_id}/contractor-view", response_model=ContractorRequestViewResponse)
async def get_contractor_request_view(
    request_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> ContractorRequestViewResponse:
    async with uow:
        service = build_offer_service(uow)
        item = await service.get_request_view(current_user=current_user, request_id=request_id)

    return ContractorRequestViewResponse(
        data={
            "request_id": item.request_id,
            "description": item.description,
            "status": item.status,
            "status_label": item.status_label,
            "deadline_at": item.deadline_at,
            "owner_user_id": item.owner_user_id,
            "owner_full_name": item.owner_full_name,
            "files": [
                RequestFileSchema(
                    id=f.id,
                    path=f.path,
                    name=f.name,
                    download_url=f"/api/v1/files/{f.id}/download",
                )
                for f in item.files
            ],
            "existing_offer": (
                {
                    "offer_id": item.existing_offer.offer_id,
                    "status": item.existing_offer.status,
                    "status_label": item.existing_offer.status_label,
                    "files": [
                        RequestFileSchema(
                            id=f.id,
                            path=f.path,
                            name=f.name,
                            download_url=f"/api/v1/files/{f.id}/download",
                        )
                        for f in item.existing_offer.files
                    ],
                }
                if item.existing_offer is not None
                else None
            ),
        },
        _links=LinkSet(
            self=Link(href=f"/api/v1/requests/{request_id}/contractor-view", method="GET"),
            available_actions=_contractor_request_actions(
                request_id=request_id,
                workspace_offer_id=item.latest_offer_id,
                current_user=current_user,
                can_create_offer=item.status == "open" and item.existing_offer is None,
            ),
        ),
    )


@router.post("/requests/{request_id}/offers", response_model=OfferCreateResponse)
async def create_empty_offer(
    request_id: int = PathParam(..., ge=1),
    payload: OfferCreatePayload | None = Body(default=None),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferCreateResponse:
    async with uow:
        service = build_offer_service(uow)
        offer_id = await service.create_offer(
            current_user=current_user,
            request_id=request_id,
            offer_amount=(payload.offer_amount if payload is not None else None),
        )
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    return OfferCreateResponse(
        data={"offer_id": offer_id, "request_id": request_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/workspace", method="GET"),
            available_actions=actions,
        ),
    )


@router.get("/offers/{offer_id}/workspace", response_model=OfferWorkspaceResponse)
async def get_offer_workspace(
    offer_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferWorkspaceResponse:
    async with uow:
        service = build_offer_service(uow)
        item = await service.get_workspace(current_user=current_user, offer_id=offer_id)
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    return OfferWorkspaceResponse(
        data={
            "request": {
                "request_id": item.request.request_id,
                "description": item.request.description,
                "status": item.request.status,
                "status_label": item.request.status_label,
                "initial_amount": item.request.initial_amount,
                "final_amount": item.request.final_amount,
                "deadline_at": item.request.deadline_at,
                "owner_user_id": item.request.owner_user_id,
                "owner_full_name": item.request.owner_full_name,
                "created_at": item.request.created_at,
                "updated_at": item.request.updated_at,
                "closed_at": item.request.closed_at,
                "files": [
                    RequestFileSchema(
                        id=f.id,
                        path=f.path,
                        name=f.name,
                        download_url=f"/api/v1/files/{f.id}/download",
                    )
                    for f in item.request.files
                ],
            },
            "offer": {
                "offer_id": item.offer.offer_id,
                "status": item.offer.status,
                "status_label": item.offer.status_label,
                "offer_amount": item.offer.offer_amount,
                "created_at": item.offer.created_at,
                "updated_at": item.offer.updated_at,
                "files": [
                    RequestFileSchema(
                        id=f.id,
                        path=f.path,
                        name=f.name,
                        download_url=f"/api/v1/files/{f.id}/download",
                    )
                    for f in item.offer.files
                ],
            },
            "offers": [
                {
                    "offer_id": request_offer.offer_id,
                    "status": request_offer.status,
                    "status_label": request_offer.status_label,
                    "offer_amount": request_offer.offer_amount,
                    "created_at": request_offer.created_at,
                    "updated_at": request_offer.updated_at,
                    "files": [
                        RequestFileSchema(
                            id=f.id,
                            path=f.path,
                            name=f.name,
                            download_url=f"/api/v1/files/{f.id}/download",
                        )
                        for f in request_offer.files
                    ],
                    "_links": LinkSet(
                        self=Link(href=f"/api/v1/offers/{request_offer.offer_id}/workspace", method="GET"),
                        available_actions=await _build_offer_list_item_links(
                            current_user=current_user,
                            offer_id=request_offer.offer_id,
                            uow=uow,
                        ),
                    ),
                }
                for request_offer in item.offers
            ],
            "contractor": {
                "user_id": item.contractor.user_id,
                "full_name": item.contractor.full_name,
                "phone": item.contractor.phone,
                "mail": item.contractor.mail,
                "company_name": item.contractor.company_name,
                "inn": item.contractor.inn,
                "company_phone": item.contractor.company_phone,
                "company_mail": item.contractor.company_mail,
                "address": item.contractor.address,
                "note": item.contractor.note,
            },
        },
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/workspace", method="GET"),
            available_actions=actions,
        ),
    )


@router.patch("/offers/{offer_id}/status", response_model=OfferStatusMutationResponse)
async def update_offer_status(
    payload: OfferStatusUpdatePayload = Body(...),
    offer_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferStatusMutationResponse:
    async with uow:
        service = build_offer_service(uow)
        status = await service.update_status(current_user=current_user, offer_id=offer_id, status=payload.status)
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    return OfferStatusMutationResponse(
        data={"offer_id": offer_id, "status": status},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/workspace", method="GET"),
            available_actions=actions,
        ),
    )


@router.patch("/offers/{offer_id}", response_model=OfferEditResponse)
async def update_offer(
    payload: OfferEditPayload = Body(...),
    offer_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferEditResponse:
    async with uow:
        service = build_offer_service(uow)
        offer_amount = await service.update_amount(
            current_user=current_user,
            offer_id=offer_id,
            offer_amount=payload.offer_amount,
        )
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    return OfferEditResponse(
        data={"offer_id": offer_id, "offer_amount": offer_amount},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/workspace", method="GET"),
            available_actions=actions,
        ),
    )


@router.post("/offers/{offer_id}/files", response_model=OfferFileMutationResponse)
async def add_offer_file(
    offer_id: int = PathParam(..., ge=1),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferFileMutationResponse:
    prepared = await FileService().prepare_upload(file)

    offer_file_service: FileService | None = None
    try:
        async with uow:
            offer_file_service = FileService(uow.files)
            service = build_offer_service(uow, file_service=offer_file_service)
            file_id = await service.add_file(
                current_user=current_user,
                offer_id=offer_id,
                upload=AttachmentFileInput(
                    original_name=prepared.original_name,
                    content_bytes=prepared.content_bytes,
                    mime_type=prepared.mime_type,
                ),
            )
            actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)
    except Exception:
        if offer_file_service is not None:
            await offer_file_service.cleanup_tracked_objects()
        raise


    return OfferFileMutationResponse(
        data={"offer_id": offer_id, "file_id": file_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/workspace", method="GET"),
            available_actions=actions,
        ),
    )


@router.delete("/offers/{offer_id}/files/{file_id}", response_model=OfferFileMutationResponse)
async def delete_offer_file(
    offer_id: int = PathParam(..., ge=1),
    file_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferFileMutationResponse:
    async with uow:
        service = build_offer_service(uow)
        await service.remove_file(current_user=current_user, offer_id=offer_id, file_id=file_id)
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    return OfferFileMutationResponse(
        data={"offer_id": offer_id, "file_id": file_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/workspace", method="GET"),
            available_actions=actions,
        ),
    )


@router.get("/offers/{offer_id}/messages", response_model=OfferMessageListResponse)
async def list_offer_messages(
    offer_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferMessageListResponse:
    async with uow:
        service = build_offer_service(uow)
        items = await service.list_messages(current_user=current_user, offer_id=offer_id)
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    return OfferMessageListResponse(
        data=OfferMessageListData(
            offer_id=offer_id,
            items=[
                OfferMessageSchema(
                    id=item.id,
                    user_id=item.user_id,
                    user_full_name=item.user_full_name,
                    text=item.text,
                    type=item.type,
                    status=item.status,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    read_by=[
                        OfferMessageReadBySchema(
                            user_id=reader.user_id,
                            user_full_name=reader.user_full_name,
                            read_at=reader.read_at,
                        )
                        for reader in item.read_by
                    ],
                    attachments=[
                        RequestFileSchema(
                            id=f.id,
                            path=f.path,
                            name=f.name,
                            download_url=f"/api/v1/files/{f.id}/download",
                        )
                        for f in item.attachments
                    ],
                )
                for item in items
            ],
        ),
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/messages", method="GET"),
            available_actions=actions,
        ),
    )


@router.post("/offers/{offer_id}/messages", response_model=OfferMessageCreateResponse)
async def create_offer_message(
    payload: OfferMessageCreatePayload = Body(...),
    offer_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferMessageCreateResponse:
    realtime_service = ChatRealtimeService()
    result, message_payload = await realtime_service.create_message(
        current_user=current_user,
        offer_id=offer_id,
        text=payload.text,
    )
    async with uow:
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    await get_chat_runtime().publish_chat_event(
        chat_id=result.chat_id,
        event=OutboundEnvelope(
            type="message.created",
            data=message_payload,
        ),
    )

    return OfferMessageCreateResponse(
        data={"offer_id": offer_id, "message_id": result.message_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/messages", method="GET"),
            available_actions=actions,
        ),
    )


@router.post("/offers/{offer_id}/messages/files", response_model=OfferMessageFileUploadResponse)
async def upload_offer_message_file(
    offer_id: int = PathParam(..., ge=1),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferMessageFileUploadResponse:
    prepared = await FileService().prepare_upload(file)
    realtime_service = ChatRealtimeService()
    uploaded = await realtime_service.upload_message_file(
        current_user=current_user,
        offer_id=offer_id,
        upload=AttachmentFileInput(
            original_name=prepared.original_name,
            content_bytes=prepared.content_bytes,
            mime_type=prepared.mime_type,
        ),
    )

    async with uow:
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    return OfferMessageFileUploadResponse(
        data=uploaded,
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/messages/files", method="POST"),
            available_actions=actions,
        ),
    )


@router.post("/offers/{offer_id}/messages/attachments", response_model=OfferMessageCreateResponse)
async def create_offer_message_with_attachments(
    offer_id: int = PathParam(..., ge=1),
    text: str = Form(...),
    files: list[UploadFile] = File(default_factory=list),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferMessageCreateResponse:
    if len(files) > _MAX_ATTACHMENTS_PER_MESSAGE:
        raise Conflict("Too many attachments")

    attachments: list[AttachmentFileInput] = []
    total_size = 0
    for file in files:
        prepared = await FileService().prepare_upload(file)
        total_size += len(prepared.content_bytes)
        if total_size > _MAX_TOTAL_ATTACHMENT_SIZE_BYTES:
            raise Conflict("Attachments total size exceeded")
        attachments.append(
            AttachmentFileInput(
                original_name=prepared.original_name,
                content_bytes=prepared.content_bytes,
                mime_type=prepared.mime_type,
            )
        )

    offer_file_service: FileService | None = None
    try:
        async with uow:
            offer_file_service = FileService(uow.files)
            service = build_offer_service(uow, file_service=offer_file_service)
            result = await service.create_message(
                current_user=current_user,
                offer_id=offer_id,
                text=text,
                attachments=attachments,
            )
            actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)
    except Exception:
        if offer_file_service is not None:
            await offer_file_service.cleanup_tracked_objects()
        raise

    message_payload = await ChatRealtimeService().load_message_payload(
        offer_id=result.offer_id,
        message_id=result.message_id,
    )
    await get_chat_runtime().publish_chat_event(
        chat_id=result.chat_id,
        event=OutboundEnvelope(
            type="message.created",
            data=message_payload,
        ),
    )

    return OfferMessageCreateResponse(
        data={"offer_id": offer_id, "message_id": result.message_id},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/messages", method="GET"),
            available_actions=actions,
        ),
    )


@router.patch("/offers/{offer_id}/messages/received", response_model=OfferMessageStatusUpdateResponse)
async def mark_offer_messages_received(
    payload: OfferMessageStatusUpdatePayload = Body(...),
    offer_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferMessageStatusUpdateResponse:
    async with uow:
        service = build_offer_service(uow)
        ack = await service.mark_messages_received(
            current_user=current_user,
            offer_id=offer_id,
            message_ids=payload.message_ids,
            up_to_message_id=payload.up_to_message_id,
        )
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    if ack.updated_message_ids:
        await get_chat_runtime().publish_chat_event(
            chat_id=ack.chat_id,
            event=OutboundEnvelope(
                type="message.delivered",
                data={
                    "chat_id": ack.chat_id,
                    "user_id": current_user.user_id,
                    "message_ids": ack.updated_message_ids,
                },
            ),
        )

    return OfferMessageStatusUpdateResponse(
        data={"offer_id": offer_id, "updated_count": ack.updated_count},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/messages/received", method="PATCH"),
            available_actions=actions,
        ),
    )


@router.patch("/offers/{offer_id}/messages/read", response_model=OfferMessageStatusUpdateResponse)
async def mark_offer_messages_read(
    payload: OfferMessageStatusUpdatePayload = Body(...),
    offer_id: int = PathParam(..., ge=1),
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> OfferMessageStatusUpdateResponse:
    async with uow:
        service = build_offer_service(uow)
        ack = await service.mark_messages_read(
            current_user=current_user,
            offer_id=offer_id,
            message_ids=payload.message_ids,
            up_to_message_id=payload.up_to_message_id,
        )
        profile = await uow.profiles.get_by_id(current_user.user_id) if uow.profiles is not None else None
        actions = await _resolve_offer_action_links(offer_id=offer_id, current_user=current_user, uow=uow)

    if ack.updated_message_ids:
        await get_chat_runtime().publish_chat_event(
            chat_id=ack.chat_id,
            event=OutboundEnvelope(
                type="message.read",
                data={
                    "chat_id": ack.chat_id,
                    "user_id": current_user.user_id,
                    "user_full_name": profile.full_name if profile else None,
                    "message_ids": ack.updated_message_ids,
                    "last_read_message_id": ack.last_read_message_id,
                },
            ),
        )

    return OfferMessageStatusUpdateResponse(
        data={"offer_id": offer_id, "updated_count": ack.updated_count},
        _links=LinkSet(
            self=Link(href=f"/api/v1/offers/{offer_id}/messages/read", method="PATCH"),
            available_actions=actions,
        ),
    )
