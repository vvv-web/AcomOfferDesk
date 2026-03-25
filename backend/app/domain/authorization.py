from __future__ import annotations

from collections.abc import Iterable

from app.domain.auth_context import CurrentUser
from app.domain.exceptions import Forbidden


def has_permission(current_user: CurrentUser, permission_code: str) -> bool:
    return permission_code in current_user.permissions


def require_permission(
    current_user: CurrentUser,
    permission_code: str,
    *,
    message: str = "Insufficient permissions",
) -> None:
    if not has_permission(current_user, permission_code):
        raise Forbidden(message)


def require_any_permission(
    current_user: CurrentUser,
    permission_codes: Iterable[str],
    *,
    message: str = "Insufficient permissions",
) -> None:
    if not any(has_permission(current_user, permission_code) for permission_code in permission_codes):
        raise Forbidden(message)
