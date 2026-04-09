from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from app.core.config import settings
from app.domain.exceptions import Forbidden
from app.models.auth_models import UserAuthAccount
from app.models.orm_models import User
from app.repositories.user_auth_accounts import UserAuthAccountRepository
from app.repositories.user_contact_channels import UserContactChannelRepository
from app.repositories.users import UserRepository
from app.services.keycloak_oidc import KeycloakAccessTokenClaims


_LOCAL_USER_ID_PATTERN = re.compile(r"[^a-z0-9_]+")


@dataclass(frozen=True, slots=True)
class SyncedIdentity:
    user: User
    auth_provider: str
    created_local_user: bool


def _normalize_local_user_id(username: str | None, *, subject: str) -> str:
    candidate = (username or "").strip().lower()
    candidate = _LOCAL_USER_ID_PATTERN.sub("_", candidate).strip("_")
    if not candidate:
        candidate = f"kc_{hashlib.sha256(subject.encode('utf-8')).hexdigest()[:12]}"
    return candidate[:128]


class IdentitySyncService:
    def __init__(
        self,
        *,
        users: UserRepository,
        user_auth_accounts: UserAuthAccountRepository,
        user_contact_channels: UserContactChannelRepository,
    ) -> None:
        self._users = users
        self._user_auth_accounts = user_auth_accounts
        self._user_contact_channels = user_contact_channels

    async def sync_keycloak_identity(
        self,
        claims: KeycloakAccessTokenClaims,
        *,
        allow_user_creation: bool = False,
    ) -> SyncedIdentity:
        account = await self._user_auth_accounts.get_by_provider_subject(
            provider="keycloak",
            subject=claims.subject,
        )
        created_local_user = False

        if account is None:
            user = await self._resolve_or_create_local_user(claims, allow_user_creation=allow_user_creation)
            account = UserAuthAccount(
                id_user=user.id,
                provider="keycloak",
                external_subject_id=claims.subject,
                external_username=claims.preferred_username,
                external_email=claims.email,
                is_active=True,
            )
            await self._user_auth_accounts.add(account)
            created_local_user = user.id_role == settings.contractor_role_id and user.status == "review"
        else:
            user = await self._users.get_by_id(account.id_user)
            if user is None:
                raise ValueError(f"Broken auth account link for user {account.id_user}")

        await self._user_auth_accounts.touch_login(
            account=account,
            username=claims.preferred_username,
            email=claims.email,
        )

        if claims.email:
            await self._user_contact_channels.upsert_channel(
                user_id=user.id,
                channel_type="email",
                channel_value=claims.email,
                is_verified=claims.email_verified,
                is_primary=True,
            )

        return SyncedIdentity(
            user=user,
            auth_provider="keycloak",
            created_local_user=created_local_user,
        )

    async def _resolve_or_create_local_user(
        self,
        claims: KeycloakAccessTokenClaims,
        *,
        allow_user_creation: bool,
    ) -> User:
        if (
            settings.keycloak_bootstrap_binding_enabled
            and claims.preferred_username == settings.keycloak_bootstrap_app_username
        ):
            bootstrap_user = await self._users.get_by_id("superadmin")
            if bootstrap_user is not None:
                existing_binding = await self._user_auth_accounts.get_by_user_provider(
                    user_id=bootstrap_user.id,
                    provider="keycloak",
                )
                if existing_binding is None:
                    return bootstrap_user

        if not allow_user_creation:
            raise Forbidden("Local application account is not linked")

        user_id = _normalize_local_user_id(claims.preferred_username, subject=claims.subject)
        if await self._users.exists(user_id):
            user_id = f"{user_id}_{hashlib.sha256(claims.subject.encode('utf-8')).hexdigest()[:8]}"

        user = User(
            id=user_id,
            id_role=settings.contractor_role_id,
            status="review",
        )
        await self._users.add(user)
        return user
