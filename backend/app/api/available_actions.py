from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from app.domain.auth_context import CurrentUser
from app.domain.authorization import has_permission
from app.domain.exceptions import Forbidden
from app.domain.permissions import PermissionCodes
from app.schemas.links import Link


class ApiAction:
    USERS_LIST = "users.list"
    USERS_ECONOMISTS_LIST = "users.economists.list"
    USERS_REGISTER = "users.register"
    USERS_STATUS_UPDATE = "users.status.update"
    USERS_ROLE_UPDATE = "users.role.update"
    USERS_MANAGER_CANDIDATES_LIST = "users.manager_candidates.list"
    USERS_ME_GET = "users.me.get"
    USERS_ME_CREDENTIALS_UPDATE = "users.me.credentials.update"
    USERS_ME_PROFILE_UPDATE = "users.me.profile.update"
    USERS_ME_COMPANY_CONTACTS_UPDATE = "users.me.company_contacts.update"
    USERS_ME_UNAVAILABILITY_SET = "users.me.unavailability.set"
    USERS_SUBORDINATE_PROFILE_GET = "users.subordinate.profile.get"
    USERS_SUBORDINATE_UNAVAILABILITY_SET = "users.subordinate.unavailability.set"
    USERS_REQUEST_ECONOMISTS_LIST = "users.request_economists.list"
    USERS_REQUEST_CONTRACTORS_LIST = "users.request_contractors.list"
    REQUESTS_LIST = "requests.list"
    REQUESTS_CREATE = "requests.create"
    REQUESTS_OPEN_LIST = "requests.open.list"
    REQUESTS_OFFERED_LIST = "requests.offered.list"
    REQUESTS_GET = "requests.get"
    REQUESTS_UPDATE = "requests.update"
    REQUESTS_EMAIL_NOTIFICATIONS_SEND = "requests.email_notifications.send"
    REQUESTS_FILES_ADD = "requests.files.add"
    REQUESTS_FILES_DELETE = "requests.files.delete"
    REQUESTS_DELETED_ALERTS_VIEWED = "requests.deleted_alerts.viewed"
    REQUESTS_CONTRACTOR_VIEW = "requests.contractor_view"
    OFFERS_CONTRACTOR_INFO_GET = "offers.contractor_info.get"
    OFFERS_CREATE = "offers.create"
    OFFERS_WORKSPACE_GET = "offers.workspace.get"
    OFFERS_UPDATE = "offers.update"
    OFFERS_STATUS_UPDATE = "offers.status.update"
    OFFERS_FILES_ADD = "offers.files.add"
    OFFERS_FILES_DELETE = "offers.files.delete"
    OFFER_MESSAGES_LIST = "offers.messages.list"
    OFFER_MESSAGES_CREATE = "offers.messages.create"
    OFFER_MESSAGE_FILES_UPLOAD = "offers.messages.files.upload"
    OFFER_MESSAGE_ATTACHMENTS_CREATE = "offers.messages.attachments.create"
    OFFER_MESSAGES_RECEIVED = "offers.messages.received"
    OFFER_MESSAGES_READ = "offers.messages.read"
    FILES_DOWNLOAD = "files.download"
    FEEDBACK_CREATE = "feedback.create"
    FEEDBACK_LIST = "feedback.list"
    DASHBOARD_RESPONSIBILITY = "dashboard.responsibility"
    NORMATIVE_FILE_UPLOAD = "normative_file.upload"


@dataclass(frozen=True, slots=True)
class ActionDescriptor:
    href_template: str
    method: str
    permission_code: str | None = None


@dataclass(frozen=True, slots=True)
class ActionRequest:
    key: str
    params: Mapping[str, Any] | None = None
    guard: Callable[[], None] | None = None
    enabled: bool = True


class _SafeFormatDict(dict[str, Any]):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


ACTION_REGISTRY: dict[str, ActionDescriptor] = {
    ApiAction.USERS_LIST: ActionDescriptor("/api/v1/users", "GET", PermissionCodes.USERS_READ),
    ApiAction.USERS_ECONOMISTS_LIST: ActionDescriptor("/api/v1/users/economists", "GET", PermissionCodes.USERS_READ),
    ApiAction.USERS_REGISTER: ActionDescriptor("/api/v1/users/register", "POST", PermissionCodes.USERS_CREATE),
    ApiAction.USERS_STATUS_UPDATE: ActionDescriptor("/api/v1/users/{user_id}/status", "PATCH", PermissionCodes.USERS_STATUS_UPDATE),
    ApiAction.USERS_ROLE_UPDATE: ActionDescriptor("/api/v1/users/{user_id}/role", "PATCH", PermissionCodes.USERS_ROLE_UPDATE),
    ApiAction.USERS_MANAGER_CANDIDATES_LIST: ActionDescriptor(
        "/api/v1/users/manager-candidates",
        "GET",
        PermissionCodes.USERS_CREATE,
    ),
    ApiAction.USERS_ME_GET: ActionDescriptor("/api/v1/users/me", "GET", PermissionCodes.PROFILE_MANAGE_OWN),
    ApiAction.USERS_ME_CREDENTIALS_UPDATE: ActionDescriptor(
        "/api/v1/users/me/credentials",
        "PATCH",
        PermissionCodes.PROFILE_MANAGE_OWN,
    ),
    ApiAction.USERS_ME_PROFILE_UPDATE: ActionDescriptor(
        "/api/v1/users/me/profile",
        "PATCH",
        PermissionCodes.PROFILE_MANAGE_OWN,
    ),
    ApiAction.USERS_ME_COMPANY_CONTACTS_UPDATE: ActionDescriptor(
        "/api/v1/users/me/company-contacts",
        "PATCH",
        PermissionCodes.COMPANY_CONTACTS_MANAGE_OWN,
    ),
    ApiAction.USERS_ME_UNAVAILABILITY_SET: ActionDescriptor(
        "/api/v1/users/me/unavailability-period",
        "POST",
        PermissionCodes.UNAVAILABILITY_MANAGE_OWN,
    ),
    ApiAction.USERS_SUBORDINATE_PROFILE_GET: ActionDescriptor(
        "/api/v1/users/{user_id}/profile",
        "GET",
        PermissionCodes.UNAVAILABILITY_MANAGE_SUBORDINATE,
    ),
    ApiAction.USERS_SUBORDINATE_UNAVAILABILITY_SET: ActionDescriptor(
        "/api/v1/users/{user_id}/unavailability-period",
        "POST",
        PermissionCodes.UNAVAILABILITY_MANAGE_SUBORDINATE,
    ),
    ApiAction.USERS_REQUEST_ECONOMISTS_LIST: ActionDescriptor(
        "/api/v1/users/request-economists",
        "GET",
        PermissionCodes.REQUESTS_UPDATE,
    ),
    ApiAction.USERS_REQUEST_CONTRACTORS_LIST: ActionDescriptor(
        "/api/v1/users/request-contractors",
        "GET",
        PermissionCodes.REQUESTS_CREATE,
    ),
    ApiAction.REQUESTS_LIST: ActionDescriptor("/api/v1/requests", "GET", PermissionCodes.REQUESTS_READ),
    ApiAction.REQUESTS_CREATE: ActionDescriptor("/api/v1/requests", "POST", PermissionCodes.REQUESTS_CREATE),
    ApiAction.REQUESTS_OPEN_LIST: ActionDescriptor("/api/v1/requests/open", "GET", PermissionCodes.REQUESTS_OPEN_READ),
    ApiAction.REQUESTS_OFFERED_LIST: ActionDescriptor(
        "/api/v1/requests/offered",
        "GET",
        PermissionCodes.REQUESTS_OFFERED_READ,
    ),
    ApiAction.REQUESTS_GET: ActionDescriptor("/api/v1/requests/{request_id}", "GET", PermissionCodes.REQUESTS_READ),
    ApiAction.REQUESTS_UPDATE: ActionDescriptor("/api/v1/requests/{request_id}", "PATCH", PermissionCodes.REQUESTS_UPDATE),
    ApiAction.REQUESTS_EMAIL_NOTIFICATIONS_SEND: ActionDescriptor(
        "/api/v1/requests/{request_id}/email-notifications",
        "POST",
        PermissionCodes.REQUESTS_EMAIL_NOTIFICATIONS_SEND,
    ),
    ApiAction.REQUESTS_FILES_ADD: ActionDescriptor(
        "/api/v1/requests/{request_id}/files",
        "POST",
        PermissionCodes.REQUESTS_FILES_UPLOAD,
    ),
    ApiAction.REQUESTS_FILES_DELETE: ActionDescriptor(
        "/api/v1/requests/{request_id}/files/{file_id}",
        "DELETE",
        PermissionCodes.REQUESTS_FILES_DELETE,
    ),
    ApiAction.REQUESTS_DELETED_ALERTS_VIEWED: ActionDescriptor(
        "/api/v1/requests/deleted-alerts/viewed",
        "PATCH",
        PermissionCodes.REQUESTS_DELETED_ALERTS_MARK_VIEWED,
    ),
    ApiAction.REQUESTS_CONTRACTOR_VIEW: ActionDescriptor(
        "/api/v1/requests/{request_id}/contractor-view",
        "GET",
        PermissionCodes.REQUESTS_CONTRACTOR_VIEW_READ,
    ),
    ApiAction.OFFERS_CONTRACTOR_INFO_GET: ActionDescriptor(
        "/api/v1/offers?id_user={contractor_user_id}",
        "GET",
        PermissionCodes.OFFERS_CONTRACTOR_INFO_READ,
    ),
    ApiAction.OFFERS_CREATE: ActionDescriptor(
        "/api/v1/requests/{request_id}/offers",
        "POST",
        PermissionCodes.OFFERS_CREATE,
    ),
    ApiAction.OFFERS_WORKSPACE_GET: ActionDescriptor(
        "/api/v1/offers/{offer_id}/workspace",
        "GET",
        PermissionCodes.OFFERS_WORKSPACE_READ,
    ),
    ApiAction.OFFERS_UPDATE: ActionDescriptor("/api/v1/offers/{offer_id}", "PATCH", PermissionCodes.OFFERS_UPDATE),
    ApiAction.OFFERS_STATUS_UPDATE: ActionDescriptor(
        "/api/v1/offers/{offer_id}/status",
        "PATCH",
        PermissionCodes.OFFERS_STATUS_UPDATE,
    ),
    ApiAction.OFFERS_FILES_ADD: ActionDescriptor(
        "/api/v1/offers/{offer_id}/files",
        "POST",
        PermissionCodes.OFFERS_FILES_UPLOAD,
    ),
    ApiAction.OFFERS_FILES_DELETE: ActionDescriptor(
        "/api/v1/offers/{offer_id}/files/{file_id}",
        "DELETE",
        PermissionCodes.OFFERS_FILES_DELETE,
    ),
    ApiAction.OFFER_MESSAGES_LIST: ActionDescriptor(
        "/api/v1/offers/{offer_id}/messages",
        "GET",
        PermissionCodes.CHAT_READ,
    ),
    ApiAction.OFFER_MESSAGES_CREATE: ActionDescriptor(
        "/api/v1/offers/{offer_id}/messages",
        "POST",
        PermissionCodes.CHAT_MESSAGE_SEND,
    ),
    ApiAction.OFFER_MESSAGE_FILES_UPLOAD: ActionDescriptor(
        "/api/v1/offers/{offer_id}/messages/files",
        "POST",
        PermissionCodes.CHAT_MESSAGE_ATTACH,
    ),
    ApiAction.OFFER_MESSAGE_ATTACHMENTS_CREATE: ActionDescriptor(
        "/api/v1/offers/{offer_id}/messages/attachments",
        "POST",
        PermissionCodes.CHAT_MESSAGE_ATTACH,
    ),
    ApiAction.OFFER_MESSAGES_RECEIVED: ActionDescriptor(
        "/api/v1/offers/{offer_id}/messages/received",
        "PATCH",
        PermissionCodes.CHAT_RECEIPTS_MARK_RECEIVED,
    ),
    ApiAction.OFFER_MESSAGES_READ: ActionDescriptor(
        "/api/v1/offers/{offer_id}/messages/read",
        "PATCH",
        PermissionCodes.CHAT_RECEIPTS_MARK_READ,
    ),
    ApiAction.FILES_DOWNLOAD: ActionDescriptor("/api/v1/files/{file_id}/download", "GET", PermissionCodes.FILES_DOWNLOAD),
    ApiAction.FEEDBACK_CREATE: ActionDescriptor("/api/v1/feedback", "POST", PermissionCodes.FEEDBACK_CREATE),
    ApiAction.FEEDBACK_LIST: ActionDescriptor("/api/v1/feedback", "GET", PermissionCodes.FEEDBACK_READ),
    ApiAction.DASHBOARD_RESPONSIBILITY: ActionDescriptor(
        "/api/v1/dashboard/responsibility",
        "GET",
        PermissionCodes.DASHBOARD_RESPONSIBILITY_READ,
    ),
    ApiAction.NORMATIVE_FILE_UPLOAD: ActionDescriptor(
        "/api/v1/normative-files/{normative_id}",
        "POST",
        PermissionCodes.NORMATIVE_FILES_MANAGE,
    ),
}


def action(
    key: str,
    *,
    params: Mapping[str, Any] | None = None,
    guard: Callable[[], None] | None = None,
    enabled: bool = True,
) -> ActionRequest:
    return ActionRequest(key=key, params=params, guard=guard, enabled=enabled)


def is_action_allowed(
    current_user: CurrentUser,
    key: str,
    *,
    guard: Callable[[], None] | None = None,
    enabled: bool = True,
) -> bool:
    if not enabled:
        return False

    descriptor = ACTION_REGISTRY[key]
    if descriptor.permission_code and not has_permission(current_user, descriptor.permission_code):
        return False

    if guard is None:
        return True

    try:
        guard()
    except Forbidden:
        return False
    return True


def build_available_actions(current_user: CurrentUser, *items: ActionRequest) -> list[Link] | None:
    links: list[Link] = []
    for item in items:
        if not is_action_allowed(current_user, item.key, guard=item.guard, enabled=item.enabled):
            continue

        descriptor = ACTION_REGISTRY[item.key]
        href = descriptor.href_template.format_map(_SafeFormatDict(item.params or {}))
        links.append(Link(href=href, method=descriptor.method))

    return links or None


def build_auth_available_actions(current_user: CurrentUser) -> list[Link] | None:
    return build_available_actions(
        current_user,
        action(ApiAction.USERS_REGISTER),
        action(ApiAction.USERS_LIST),
        action(ApiAction.USERS_ECONOMISTS_LIST),
        action(ApiAction.USERS_STATUS_UPDATE),
        action(ApiAction.USERS_ROLE_UPDATE),
        action(ApiAction.REQUESTS_LIST),
        action(ApiAction.REQUESTS_CREATE),
        action(ApiAction.REQUESTS_OPEN_LIST),
        action(ApiAction.REQUESTS_GET),
        action(ApiAction.REQUESTS_UPDATE),
        action(ApiAction.REQUESTS_FILES_ADD),
        action(ApiAction.REQUESTS_FILES_DELETE),
        action(ApiAction.REQUESTS_OFFERED_LIST),
        action(ApiAction.REQUESTS_CONTRACTOR_VIEW),
        action(ApiAction.OFFERS_CREATE),
        action(ApiAction.OFFERS_WORKSPACE_GET),
        action(ApiAction.OFFERS_STATUS_UPDATE),
        action(ApiAction.OFFERS_FILES_ADD),
        action(ApiAction.OFFERS_FILES_DELETE),
        action(ApiAction.OFFER_MESSAGES_LIST),
        action(ApiAction.OFFER_MESSAGES_CREATE),
        action(ApiAction.OFFER_MESSAGE_ATTACHMENTS_CREATE),
        action(ApiAction.OFFER_MESSAGES_RECEIVED),
        action(ApiAction.OFFER_MESSAGES_READ),
        action(ApiAction.REQUESTS_DELETED_ALERTS_VIEWED),
        action(ApiAction.FILES_DOWNLOAD),
        action(ApiAction.FEEDBACK_CREATE),
        action(ApiAction.FEEDBACK_LIST),
        action(ApiAction.DASHBOARD_RESPONSIBILITY),
        action(ApiAction.NORMATIVE_FILE_UPLOAD, params={"normative_id": 1}),
    )
