from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.core.config import settings
from app.domain.exceptions import Conflict, NotFound
from app.domain.policies import CurrentUser, OfferPolicy, RequestPolicy, UserPolicy
from app.repositories.company_contacts import CompanyContactRepository
from app.repositories.files import FileRepository
from app.repositories.messages import MessageRepository
from app.repositories.offers import OfferRepository
from app.repositories.profiles import ProfileRepository
from app.repositories.requests import RequestRepository
from app.repositories.users import UserRepository
from app.services.requests import RequestFileItem, format_offer_status, format_request_status
from app.services.tg_notifications import notify_new_message, notify_offer_status_finalized

DEFAULT_PARTNER_CARD_PATH = "uploads/Карта_партнера.pdf"
DEFAULT_PARTNER_CARD_NAME = "Карта_партнера.pdf"
EDITABLE_OFFER_STATUSES = {"submitted", "accepted", "rejected", "deleted"}


@dataclass(frozen=True)
class AttachmentFileInput:
    path: str
    name: str


@dataclass(frozen=True)
class ContractorInfo:
    user_id: str
    full_name: str | None
    phone: str | None
    mail: str | None
    company_name: str | None
    inn: str | None
    company_phone: str | None
    company_mail: str | None
    address: str | None
    note: str | None


@dataclass(frozen=True)
class ExistingOfferPreview:
    offer_id: int
    status: str
    status_label: str
    files: list[RequestFileItem]


@dataclass(frozen=True)
class ContractorRequestView:
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    owner_user_id: str
    files: list[RequestFileItem]
    existing_offer: ExistingOfferPreview | None
    latest_offer_id: int | None


@dataclass(frozen=True)
class OfferWorkspaceRequest:
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    owner_user_id: str
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    files: list[RequestFileItem] = field(default_factory=list)


@dataclass(frozen=True)
class OfferWorkspaceOffer:
    offer_id: int
    status: str
    status_label: str
    created_at: datetime
    updated_at: datetime
    files: list[RequestFileItem] = field(default_factory=list)


@dataclass(frozen=True)
class OfferWorkspace:
    request: OfferWorkspaceRequest
    offer: OfferWorkspaceOffer
    offers: list[OfferWorkspaceOffer]
    contractor: ContractorInfo


@dataclass(frozen=True)
class OfferMessageItem:
    id: int
    user_id: str
    user_full_name: str | None
    text: str
    status: str
    created_at: datetime
    updated_at: datetime
    attachments: list[RequestFileItem] = field(default_factory=list)


class OfferService:
    def __init__(
        self,
        requests: RequestRepository,
        offers: OfferRepository,
        files: FileRepository,
        messages: MessageRepository,
        profiles: ProfileRepository,
        company_contacts: CompanyContactRepository,
        users: UserRepository,
    ):
        self._requests = requests
        self._offers = offers
        self._files = files
        self._messages = messages
        self._profiles = profiles
        self._company_contacts = company_contacts
        self._users = users

    def _ensure_partner_card_file(self, files: list[RequestFileItem]) -> None:
        if any(file_item.id == 1 for file_item in files):
            return
        files.append(
            RequestFileItem(
                id=1,
                path=DEFAULT_PARTNER_CARD_PATH,
                name=DEFAULT_PARTNER_CARD_NAME,
            )
        )

    async def _load_offer_and_request(self, *, offer_id: int):
        offer = await self._offers.get_by_id(offer_id=offer_id)
        if offer is None:
            raise NotFound("Offer not found")

        request = await self._requests.get_by_id(request_id=offer.id_request)
        if request is None:
            raise NotFound("Request not found")
        return offer, request

    async def get_request_view(self, *, current_user: CurrentUser, request_id: int) -> ContractorRequestView:
        UserPolicy.can_create_offer(current_user)

        request = await self._requests.get_by_id(request_id=request_id)
        if request is None:
            raise NotFound("Request not found")

        request_files = await self._requests.list_files(request_id=request.id)
        request_file_items = [RequestFileItem(id=f.id, path=f.path, name=f.name) for f in request_files]
        self._ensure_partner_card_file(request_file_items)
        existing_offer = await self._offers.get_contractor_offer_for_request(
            request_id=request.id,
            contractor_user_id=current_user.user_id,
        )
        existing_offer_preview: ExistingOfferPreview | None = None
        if existing_offer is not None and existing_offer.status != "deleted":
            offer_files = await self._offers.list_offer_files(offer_id=existing_offer.id)
            existing_offer_preview = ExistingOfferPreview(
                offer_id=existing_offer.id,
                status=existing_offer.status,
                status_label=format_offer_status(existing_offer.status),
                files=[RequestFileItem(id=f.id, path=f.path, name=f.name) for f in offer_files],
            )

        return ContractorRequestView(
            request_id=request.id,
            description=request.description,
            status=request.status,
            status_label=format_request_status(request.status),
            deadline_at=request.deadline_at,
            owner_user_id=request.id_user,
            files=request_file_items,
            existing_offer=existing_offer_preview,
            latest_offer_id=existing_offer.id if existing_offer is not None else None,
        )

    async def create_empty_offer(self, *, current_user: CurrentUser, request_id: int) -> int:
        UserPolicy.can_create_offer(current_user)

        request = await self._requests.get_open_by_id(request_id=request_id)
        if request is None:
            raise NotFound("Open request not found")

        existing_offer = await self._offers.get_contractor_offer_for_request(
            request_id=request.id,
            contractor_user_id=current_user.user_id,
        )
        if existing_offer and existing_offer.status != "deleted":
            raise Conflict("Offer for this request already exists")

        offer = await self._offers.create(request_id=request.id, contractor_user_id=current_user.user_id)
        return offer.id

    async def get_workspace(self, *, current_user: CurrentUser, offer_id: int) -> OfferWorkspace:
        offer, request = await self._load_offer_and_request(offer_id=offer_id)
        OfferPolicy.can_access_offer_workspace(current_user, offer_owner_user_id=offer.id_user)

        profile = await self._profiles.get_by_id(offer.id_user)
        company = await self._company_contacts.get_by_id(offer.id_user)
        request_files = await self._requests.list_files(request_id=request.id)
        request_file_items = [RequestFileItem(id=f.id, path=f.path, name=f.name) for f in request_files]
        self._ensure_partner_card_file(request_file_items)
        offer_files = await self._offers.list_offer_files(offer_id=offer.id)
        request_offers = await self._offers.list_by_request(request_id=request.id)
        request_offers = [request_offer for request_offer in request_offers if request_offer.id_user == offer.id_user]

        return OfferWorkspace(
            request=OfferWorkspaceRequest(
                request_id=request.id,
                description=request.description,
                status=request.status,
                status_label=format_request_status(request.status),
                deadline_at=request.deadline_at,
                owner_user_id=request.id_user,
                created_at=request.created_at,
                updated_at=request.updated_at,
                closed_at=request.closed_at,
                files=request_file_items,
            ),
            offer=OfferWorkspaceOffer(
                offer_id=offer.id,
                status=offer.status,
                status_label=format_offer_status(offer.status),
                created_at=offer.created_at,
                updated_at=offer.updated_at,
                files=[RequestFileItem(id=f.id, path=f.path, name=f.name) for f in offer_files],
            ),
            offers=[
                OfferWorkspaceOffer(
                    offer_id=request_offer.id,
                    status=request_offer.status,
                    status_label=format_offer_status(request_offer.status),
                    created_at=request_offer.created_at,
                    updated_at=request_offer.updated_at,
                    files=[
                        RequestFileItem(id=f.id, path=f.path, name=f.name)
                        for f in await self._offers.list_offer_files(offer_id=request_offer.id)
                    ],
                )
                for request_offer in request_offers
            ],
            contractor=ContractorInfo(
                user_id=offer.id_user,
                full_name=profile.full_name if profile else None,
                phone=profile.phone if profile else None,
                mail=profile.mail if profile else None,
                company_name=company.company_name if company else None,
                inn=company.inn if company else None,
                company_phone=company.phone if company else None,
                company_mail=company.mail if company else None,
                address=company.address if company else None,
                note=company.note if company else None,
            ),
        )
    
    async def get_contractor_info(self, *, current_user: CurrentUser, contractor_user_id: str) -> ContractorInfo:
        OfferPolicy.can_view_contractor_info(current_user, contractor_user_id=contractor_user_id)

        profile = await self._profiles.get_by_id(contractor_user_id)
        company = await self._company_contacts.get_by_id(contractor_user_id)
        if profile is None and company is None:
            raise NotFound("Contractor not found")

        return ContractorInfo(
            user_id=contractor_user_id,
            full_name=profile.full_name if profile else None,
            phone=profile.phone if profile else None,
            mail=profile.mail if profile else None,
            company_name=company.company_name if company else None,
            inn=company.inn if company else None,
            company_phone=company.phone if company else None,
            company_mail=company.mail if company else None,
            address=company.address if company else None,
            note=company.note if company else None,
        )

    async def add_file(self, *, current_user: CurrentUser, offer_id: int, path: str, name: str) -> int:
        offer = await self._offers.get_by_id(offer_id=offer_id)
        if offer is None:
            raise NotFound("Offer not found")
        OfferPolicy.can_access_contractor_offer(current_user, offer_owner_user_id=offer.id_user)

        if offer.status in {"accepted", "rejected"}:
            raise Conflict("Cannot edit files for finalized offer")

        db_file = await self._files.create(path=path, name=name)
        await self._offers.attach_file(offer_id=offer.id, file_id=db_file.id)
        return db_file.id

    async def remove_file(self, *, current_user: CurrentUser, offer_id: int, file_id: int) -> None:
        offer = await self._offers.get_by_id(offer_id=offer_id)
        if offer is None:
            raise NotFound("Offer not found")
        OfferPolicy.can_access_contractor_offer(current_user, offer_owner_user_id=offer.id_user)

        detached = await self._offers.detach_file(offer_id=offer.id, file_id=file_id)
        if not detached:
            raise NotFound("File is not attached to offer")

        deleted = await self._files.delete_by_id(file_id=file_id)
        if not deleted:
            raise NotFound("File not found")
        
    async def update_status(self, *, current_user: CurrentUser, offer_id: int, status: str) -> str:
        offer, request = await self._load_offer_and_request(offer_id=offer_id)

        if status not in EDITABLE_OFFER_STATUSES:
            raise Conflict("Unsupported offer status")

        is_contractor_deleting_own_offer = (
            current_user.role_id == settings.contractor_role_id
            and current_user.user_id == offer.id_user
            and status == "deleted"
        )

        if not is_contractor_deleting_own_offer:
            RequestPolicy.can_edit(current_user, request_owner_user_id=request.id_user)

        status_changed = offer.status != status
        await self._offers.update_status(offer=offer, status=status)

        if status_changed and status in {"accepted", "rejected"}:
            tg_id = await self._users.get_active_approved_contractor_tg_id(
                user_id=offer.id_user,
                contractor_role_id=settings.contractor_role_id,
            )
            if tg_id is not None:
                await notify_offer_status_finalized(tg_id=tg_id)

        return offer.status

    async def list_messages(self, *, current_user: CurrentUser, offer_id: int) -> list[OfferMessageItem]:
        offer, _ = await self._load_offer_and_request(offer_id=offer_id)
        OfferPolicy.can_view_chat(current_user, offer_owner_user_id=offer.id_user)

        chat = await self._offers.get_chat(offer_id=offer.id)
        if chat is None:
            raise NotFound("Chat not found")

        messages = await self._messages.list_by_chat(chat_id=chat.id)
        message_ids = [item.id for item in messages]
        files_map: dict[int, list[RequestFileItem]] = {msg_id: [] for msg_id in message_ids}
        for message_id, db_file in await self._messages.list_files_by_message_ids(message_ids=message_ids):
            files_map.setdefault(message_id, []).append(
                RequestFileItem(id=db_file.id, path=db_file.path, name=db_file.name)
            )

        message_user_ids = list({item.id_user for item in messages})
        profiles = await self._profiles.get_by_ids(message_user_ids)
        full_name_by_user_id = {profile.id: profile.full_name for profile in profiles}

        return [
            OfferMessageItem(
                id=item.id,
                user_id=item.id_user,
                user_full_name=full_name_by_user_id.get(item.id_user),
                text=item.text,
                status=item.status,
                created_at=item.created_at,
                updated_at=item.updated_at,
                attachments=files_map.get(item.id, []),
            )
            for item in messages
        ]

    async def create_message(
        self,
        *,
        current_user: CurrentUser,
        offer_id: int,
        text: str,
        attachments: list[AttachmentFileInput] | None = None,
    ) -> int:
        offer, request = await self._load_offer_and_request(offer_id=offer_id)
        OfferPolicy.can_send_chat_message(
            current_user,
            offer_owner_user_id=offer.id_user,
            request_owner_user_id=request.id_user,
        )

        if not text.strip():
            raise Conflict("Message text cannot be empty")

        chat = await self._offers.get_chat(offer_id=offer.id)
        if chat is None:
            raise NotFound("Chat not found")

        message = await self._messages.create(
            chat_id=chat.id,
            user_id=current_user.user_id,
            text=text.strip(),
            status="received",
        )
        for attachment in attachments or []:
            db_file = await self._files.create(path=attachment.path, name=attachment.name)
            await self._messages.attach_file(message_id=message.id, file_id=db_file.id)

        if current_user.user_id != offer.id_user:
            tg_id = await self._users.get_active_approved_contractor_tg_id(
                user_id=offer.id_user,
                contractor_role_id=settings.contractor_role_id,
            )
            if tg_id is not None:
                await notify_new_message(tg_id=tg_id, request_id=request.id)

        return message.id
    
    async def mark_messages_received(self, *, current_user: CurrentUser, offer_id: int, message_ids: list[int]) -> int:
        offer, request = await self._load_offer_and_request(offer_id=offer_id)
        OfferPolicy.can_send_chat_message(
            current_user,
            offer_owner_user_id=offer.id_user,
            request_owner_user_id=request.id_user,
        )

        chat = await self._offers.get_chat(offer_id=offer.id)
        if chat is None:
            raise NotFound("Chat not found")

        return await self._messages.update_status_for_recipient(
            chat_id=chat.id,
            message_ids=message_ids,
            recipient_user_id=current_user.user_id,
            from_status="send",
            to_status="received",
        )

    async def mark_messages_read(self, *, current_user: CurrentUser, offer_id: int, message_ids: list[int]) -> int:
        offer, request = await self._load_offer_and_request(offer_id=offer_id)
        OfferPolicy.can_send_chat_message(
            current_user,
            offer_owner_user_id=offer.id_user,
            request_owner_user_id=request.id_user,
        )

        chat = await self._offers.get_chat(offer_id=offer.id)
        if chat is None:
            raise NotFound("Chat not found")

        ids: list[int] | None = message_ids or None
        
        return await self._messages.update_status_for_recipient(
            chat_id=chat.id,
            message_ids=ids,
            recipient_user_id=current_user.user_id,
            from_status="received",
            to_status="read",
        )