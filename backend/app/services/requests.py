from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.core.config import settings
from app.domain.exceptions import Conflict, Forbidden,  NotFound
from app.domain.policies import CurrentUser, RequestPolicy, UserPolicy
from app.repositories.files import FileRepository
from app.repositories.offers import OfferRepository
from app.repositories.requests import RequestRepository
from app.repositories.users import UserRepository
from app.services.email_notifications import EmailNotificationService
from app.services.tg_notifications import notify_new_request, notify_request_status_changed

DEFAULT_PARTNER_CARD_PATH = "uploads/Карта_партнера.pdf"
DEFAULT_PARTNER_CARD_NAME = "Карта_партнера.pdf"
EDITABLE_REQUEST_STATUSES = {"open", "review", "closed", "cancelled"}

REQUEST_STATUS_LABELS = {
    "open": "открыта",
    "review": "на рассмотрении",
    "closed": "закрыта",
    "cancelled": "отменена",
}

OFFER_STATUS_LABELS = {
    "submitted": "на рассмотрении",
    "accepted": "принят",
    "rejected": "отклонён",
    "deleted": "удалён",
}

def format_request_status(status: str | None) -> str:
    if not status:
        return "не указан"
    return REQUEST_STATUS_LABELS.get(status, status)


def format_offer_status(status: str | None) -> str:
    if not status:
        return "не указан"
    return OFFER_STATUS_LABELS.get(status, status)


@dataclass(frozen=True)
class RequestFileCreateInput:
    path: str
    name: str


@dataclass(frozen=True)
class RequestEditInput:
    status: str | None = None
    deadline_at: datetime | None = None
    owner_user_id: str | None = None


@dataclass(frozen=True)
class RequestFileItem:
    id: int
    path: str
    name: str


@dataclass(frozen=True)
class RequestListItem:
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    owner_user_id: str
    owner_full_name: str | None
    chosen_offer_id: int | None
    count_submitted: int
    count_deleted_alert: int
    count_accepted_total: int
    count_rejected_total: int
    unread_messages_count: int
    files: list[RequestFileItem] = field(default_factory=list)


@dataclass(frozen=True)
class OpenRequestListItem:
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    owner_user_id: str
    owner_full_name: str | None
    chosen_offer_id: int | None
    files: list[RequestFileItem] = field(default_factory=list)
    offers: list[OfferedRequestOfferItem] = field(default_factory=list)


@dataclass(frozen=True)
class OfferedRequestOfferItem:
    offer_id: int
    status: str
    unread_messages_count: int


@dataclass(frozen=True)
class OfferItem:
    offer_id: int
    contractor_user_id: str
    status: str
    status_label: str
    created_at: datetime
    updated_at: datetime
    offer_workspace_url: str
    contractor_full_name: str | None
    contractor_phone: str | None
    contractor_mail: str | None
    contractor_company_name: str | None
    contractor_inn: str | None
    contractor_company_phone: str | None
    contractor_company_mail: str | None
    contractor_contact_phone: str | None
    contractor_contact_mail: str | None
    contractor_address: str | None = None
    contractor_note: str | None = None
    files: list[RequestFileItem] = field(default_factory=list)
    unread_messages_count: int = 0



@dataclass(frozen=True)
class RequestDetailItem:
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    owner_user_id: str
    owner_full_name: str | None
    chosen_offer_id: int | None
    count_submitted: int
    count_deleted_alert: int
    count_accepted_total: int
    count_rejected_total: int
    unread_messages_count: int
    files: list[RequestFileItem] = field(default_factory=list)
    offers: list[OfferItem] = field(default_factory=list)


@dataclass(frozen=True)
class DeletedAlertViewedResult:
    request_id: int
    count_deleted_alert: int
    updated_at: datetime


class RequestService:
    def __init__(
        self,
        requests: RequestRepository,
        files: FileRepository,
        users: UserRepository,
        offers: OfferRepository,
        email_notifications: EmailNotificationService | None = None,
    ):
        self._requests = requests
        self._files = files
        self._users = users
        self._offers = offers
        self._email_notifications = email_notifications

    async def create_request(
        self,
        *,
        current_user: CurrentUser,
        deadline_at: datetime,
        description: str | None,
        files: list[RequestFileCreateInput],
    ) -> tuple[int, list[int]]:
        UserPolicy.can_create_request(current_user)
        if deadline_at < datetime.utcnow():
            raise Conflict("Deadline cannot be in the past")
        if not files:
            raise Conflict("At least one file is required")

        request = await self._requests.create(
            id_user=current_user.user_id,
            deadline_at=deadline_at,
            description=description,
        )

        file_ids: list[int] = []
        for file_item in files:
            db_file = await self._files.create(path=file_item.path, name=file_item.name)
            await self._requests.attach_file(request_id=request.id, file_id=db_file.id)
            file_ids.append(db_file.id)

        tg_ids = await self._users.list_active_tg_user_ids()
        await notify_new_request(
            tg_ids=tg_ids,
            request_id=request.id,
            description=description,
            deadline_at=deadline_at,
        )

        if self._email_notifications is not None:
            await self._email_notifications.notify_new_request(
                request_id=request.id,
                description=description,
                deadline_at=deadline_at,
            )

        return request.id, file_ids
    
    async def update_request(
        self,
        *,
        current_user: CurrentUser,
        request_id: int,
        data: RequestEditInput,
    ) -> None:
        request = await self._requests.get_by_id(request_id=request_id)
        if request is None:
            raise NotFound("Request not found")

        RequestPolicy.can_edit_owned_unassigned(current_user, request_owner_user_id=request.id_user)

        if data.status is not None:
            if data.status not in EDITABLE_REQUEST_STATUSES:
                raise Conflict("Unsupported request status")
            status_changed = data.status != request.status
            closed_at = request.closed_at
            chosen_offer_id = request.id_offer
            if data.status == "closed":
                closed_at = datetime.utcnow()
                chosen_offer_id = await self._requests.get_latest_accepted_offer_id(request_id=request.id)

            await self._requests.update_status(
                request=request,
                status=data.status,
                closed_at=closed_at,
                chosen_offer_id=chosen_offer_id,
            )
            if status_changed:
                tg_ids = await self._offers.list_contractor_tg_ids_for_request(
                    request_id=request.id,
                    contractor_role_id=settings.contractor_role_id,
                )
                for tg_id in tg_ids:
                    await notify_request_status_changed(tg_id=tg_id)

        if data.deadline_at is not None:
            if data.deadline_at < datetime.utcnow():
                raise Conflict("Deadline cannot be in the past")
            await self._requests.update_deadline(request=request, deadline_at=data.deadline_at)

        if data.owner_user_id is not None:
            RequestPolicy.can_change_owner(current_user, request_owner_user_id=request.id_user)
            owner = await self._users.get_by_id(data.owner_user_id)
            if owner is None:
                raise NotFound("Owner user not found")
            
            if current_user.role_id in {
                settings.project_manager_role_id,
                settings.lead_economist_role_id,
            }:
                if owner.id == current_user.user_id:
                    raise Forbidden("Owner must be from current user's subordinates")
                is_subordinate = await self._is_descendant(
                    ancestor_user_id=current_user.user_id,
                    target_user_id=owner.id,
                )
                if not is_subordinate:
                    raise Forbidden("Owner must be from current user's subordinates")
            await self._requests.update_owner(request=request, user_id=data.owner_user_id)

    async def _is_descendant(self, *, ancestor_user_id: str, target_user_id: str) -> bool:
        cursor_id: str | None = target_user_id
        visited: set[str] = set()

        while cursor_id is not None and cursor_id not in visited:
            visited.add(cursor_id)
            if cursor_id == ancestor_user_id:
                return True
            cursor_user = await self._users.get_by_id(cursor_id)
            if cursor_user is None:
                return False
            cursor_id = cursor_user.id_parent

        return False
    
    async def mark_deleted_alert_viewed(self, *, current_user: CurrentUser, request_id: int) -> DeletedAlertViewedResult:
        request = await self._requests.get_by_id(request_id=request_id)
        if request is None:
            raise NotFound("Request not found")

        RequestPolicy.can_edit(current_user, request_owner_user_id=request.id_user)

        updated_stats = await self._requests.decrement_deleted_alert(request_id=request_id)
        if updated_stats is None:
            raise NotFound("Request offer stats not found")

        return DeletedAlertViewedResult(
            request_id=updated_stats.request_id,
            count_deleted_alert=updated_stats.count_deleted_alert,
            updated_at=updated_stats.updated_at,
        )

    async def attach_file(
        self,
        *,
        current_user: CurrentUser,
        request_id: int,
        file_data: RequestFileCreateInput,
    ) -> int:
        request = await self._requests.get_by_id(request_id=request_id)
        if request is None:
            raise NotFound("Request not found")

        RequestPolicy.can_edit(current_user, request_owner_user_id=request.id_user)

        db_file = await self._files.create(path=file_data.path, name=file_data.name)
        await self._requests.attach_file(request_id=request.id, file_id=db_file.id)
        return db_file.id

    async def remove_file(
        self,
        *,
        current_user: CurrentUser,
        request_id: int,
        file_id: int,
    ) -> None:
        request = await self._requests.get_by_id(request_id=request_id)
        if request is None:
            raise NotFound("Request not found")

        RequestPolicy.can_edit(current_user, request_owner_user_id=request.id_user)

        detached = await self._requests.detach_file(request_id=request_id, file_id=file_id)
        if not detached:
            raise NotFound("File is not attached to request")

        deleted = await self._files.delete_by_id(file_id=file_id)
        if not deleted:
            raise NotFound("File not found")

    
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
        

    async def list_requests(self, *, current_user: CurrentUser) -> list[RequestListItem]:
        UserPolicy.can_view_requests(current_user)
        rows = await self._requests.list_with_stats_and_files(current_user_id=current_user.user_id)

        grouped: dict[int, RequestListItem] = {}
        for request, stats, request_file, db_file, profile, unread_messages_count in rows:
            existing = grouped.get(request.id)
            file_items = []
            if request_file and db_file:
                file_items = [RequestFileItem(id=db_file.id, path=db_file.path, name=db_file.name)]

            if existing is None:
                grouped[request.id] = RequestListItem(
                    request_id=request.id,
                    description=request.description,
                    status=request.status,
                    status_label=format_request_status(request.status),
                    deadline_at=request.deadline_at,
                    created_at=request.created_at,
                    updated_at=request.updated_at,
                    closed_at=request.closed_at,
                    owner_user_id=request.id_user,
                    owner_full_name=profile.full_name if profile else None,
                    chosen_offer_id=request.id_offer,
                    count_submitted=stats.count_submitted if stats else 0,
                    count_deleted_alert=stats.count_deleted_alert if stats else 0,
                    count_accepted_total=stats.count_accepted_total if stats else 0,
                    count_rejected_total=stats.count_rejected_total if stats else 0,
                    unread_messages_count=unread_messages_count,
                    files=file_items,
                )
                continue

            if file_items:
                existing.files.extend(file_items)

        for item in grouped.values():
            self._ensure_partner_card_file(item.files)

        return list(grouped.values())


    async def list_open_requests_for_contractor(self, *, current_user: CurrentUser) -> list[OpenRequestListItem]:
        UserPolicy.can_view_open_requests(current_user)
        rows = await self._requests.list_open_with_files()

        grouped: dict[int, OpenRequestListItem] = {}
        for request, request_file, db_file, profile in rows:
            existing = grouped.get(request.id)
            file_items = []
            if request_file and db_file:
                file_items = [RequestFileItem(id=db_file.id, path=db_file.path, name=db_file.name)]

            if existing is None:
                grouped[request.id] = OpenRequestListItem(
                    request_id=request.id,
                    description=request.description,
                    status=request.status,
                    status_label=format_request_status(request.status),
                    deadline_at=request.deadline_at,
                    created_at=request.created_at,
                    updated_at=request.updated_at,
                    closed_at=request.closed_at,
                    owner_user_id=request.id_user,
                    owner_full_name=profile.full_name if profile else None,
                    chosen_offer_id=request.id_offer,
                    files=file_items,
                )
                continue

            if file_items:
                existing.files.extend(file_items)

        for item in grouped.values():
            self._ensure_partner_card_file(item.files)

        return list(grouped.values())


    async def list_offered_requests_for_contractor(self, *, current_user: CurrentUser) -> list[OpenRequestListItem]:
        UserPolicy.can_view_offered_requests(current_user)
        rows = await self._requests.list_with_offers_for_contractor(contractor_user_id=current_user.user_id)

        grouped: dict[int, OpenRequestListItem] = {}
        request_file_ids: dict[int, set[int]] = {}
        request_offer_ids: dict[int, set[int]] = {}
        for request, offer, request_file, db_file, profile, unread_messages_count in rows:
            existing = grouped.get(request.id)
            
            if existing is None:
                existing = OpenRequestListItem(
                    request_id=request.id,
                    description=request.description,
                    status=request.status,
                    status_label=format_request_status(request.status),
                    deadline_at=request.deadline_at,
                    created_at=request.created_at,
                    updated_at=request.updated_at,
                    closed_at=request.closed_at,
                    owner_user_id=request.id_user,
                    owner_full_name=profile.full_name if profile else None,
                    chosen_offer_id=None,
                    files=[],
                    offers=[],
                )
                grouped[request.id] = existing
                request_file_ids[request.id] = set()
                request_offer_ids[request.id] = set()

            if request_file and db_file and db_file.id not in request_file_ids[request.id]:
                request_file_ids[request.id].add(db_file.id)
                existing.files.append(RequestFileItem(id=db_file.id, path=db_file.path, name=db_file.name))

            if offer.id not in request_offer_ids[request.id]:
                request_offer_ids[request.id].add(offer.id)
                existing.offers.append(
                    OfferedRequestOfferItem(
                        offer_id=offer.id,
                        status=offer.status,
                        unread_messages_count=unread_messages_count,
                    )
                )
                

        for item in grouped.values():
            self._ensure_partner_card_file(item.files)

        return list(grouped.values())
    
    
    async def list_open_requests(self, *, current_user: CurrentUser) -> list[RequestListItem]:
        UserPolicy.can_view_open_requests(current_user)
        rows = await self._requests.list_open_with_stats_and_files()

        grouped: dict[int, RequestListItem] = {}
        for request, stats, request_file, db_file, profile in rows:
            existing = grouped.get(request.id)
            file_items = []
            if request_file and db_file:
                file_items = [RequestFileItem(id=db_file.id, path=db_file.path, name=db_file.name)]

            if existing is None:
                grouped[request.id] = RequestListItem(
                    request_id=request.id,
                    description=request.description,
                    status=request.status,
                    status_label=format_request_status(request.status),
                    deadline_at=request.deadline_at,
                    created_at=request.created_at,
                    updated_at=request.updated_at,
                    closed_at=request.closed_at,
                    owner_user_id=request.id_user,
                    owner_full_name=profile.full_name if profile else None,
                    chosen_offer_id=request.id_offer,
                    count_submitted=stats.count_submitted if stats else 0,
                    count_deleted_alert=stats.count_deleted_alert if stats else 0,
                    count_accepted_total=stats.count_accepted_total if stats else 0,
                    count_rejected_total=stats.count_rejected_total if stats else 0,
                    unread_messages_count=0,
                    files=file_items,
                )
                continue

            if file_items:
                existing.files.extend(file_items)

        for item in grouped.values():
            self._ensure_partner_card_file(item.files)

        return list(grouped.values())


    async def get_request_details(self, *, current_user: CurrentUser, request_id: int) -> RequestDetailItem:
        UserPolicy.can_view_requests(current_user)

        request_row = await self._requests.get_with_stats(request_id=request_id)
        if request_row is None:
            raise NotFound("Request not found")

        request, stats, owner_profile = request_row
        request_files = await self._requests.list_files(request_id=request_id)
        request_file_items = [
            RequestFileItem(id=file.id, path=file.path, name=file.name)
            for file in request_files
        ]
        self._ensure_partner_card_file(request_file_items)

        offer_rows = await self._requests.list_offers_with_files_and_contacts(
            request_id=request_id,
            current_user_id=current_user.user_id,
        )

        offers_by_id: dict[int, OfferItem] = {}
        for offer, offer_file, profile, company_contact, unread_messages_count in offer_rows:
            offer_item = offers_by_id.get(offer.id)
            if offer_item is None:
                offer_item = OfferItem(
                    offer_id=offer.id,
                    contractor_user_id=offer.id_user,
                    status=offer.status,
                    status_label=format_offer_status(offer.status),
                    created_at=offer.created_at,
                    updated_at=offer.updated_at,
                    offer_workspace_url=f"/api/v1/offers/{offer.id}/workspace",
                    contractor_full_name=profile.full_name if profile else None,
                    contractor_phone=(company_contact.phone if company_contact else (profile.phone if profile else None)),
                    contractor_mail=(company_contact.mail if company_contact else (profile.mail if profile else None)),
                    contractor_inn=company_contact.inn if company_contact else None,
                    contractor_company_name=company_contact.company_name if company_contact else None,
                    contractor_company_phone=company_contact.phone if company_contact else None,
                    contractor_company_mail=company_contact.mail if company_contact else None,
                    contractor_contact_phone=profile.phone if profile else None,
                    contractor_contact_mail=profile.mail if profile else None,
                    contractor_address=company_contact.address if company_contact else None,
                    contractor_note=company_contact.note if company_contact else None,
                    files=[],
                    unread_messages_count=unread_messages_count,
                )
                offers_by_id[offer.id] = offer_item

            if offer_file is not None:
                offer_item.files.append(RequestFileItem(id=offer_file.id, path=offer_file.path, name=offer_file.name))

        return RequestDetailItem(
            request_id=request.id,
            description=request.description,
            status=request.status,
            status_label=format_request_status(request.status),
            deadline_at=request.deadline_at,
            created_at=request.created_at,
            updated_at=request.updated_at,
            closed_at=request.closed_at,
            owner_user_id=request.id_user,
            owner_full_name=owner_profile.full_name if owner_profile else None,
            chosen_offer_id=request.id_offer,
            count_submitted=stats.count_submitted if stats else 0,
            count_deleted_alert=stats.count_deleted_alert if stats else 0,
            count_accepted_total=stats.count_accepted_total if stats else 0,
            count_rejected_total=stats.count_rejected_total if stats else 0,
            unread_messages_count=sum(offer_item.unread_messages_count for offer_item in offers_by_id.values()),
            files=request_file_items,
            offers=list(offers_by_id.values()),
        )