from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.domain.exceptions import Conflict, Forbidden, NotFound
from app.domain.policies import CurrentUser, UserPolicy
from app.models.orm_models import CompanyContact, Profile, TgUser, User
from app.repositories.company_contacts import CompanyContactRepository
from app.repositories.profiles import ProfileRepository
from app.repositories.tg_users import TgUserRepository
from app.repositories.users import UserRepository
from app.services.tg_notifications import notify_access_closed, notify_access_opened

ROLE_NAME_SUPERADMIN = "Суперадмин"
ROLE_NAME_ADMIN = "Администратор"
ROLE_NAME_PROJECT_MANAGER = "Руководитель Проекта"
ROLE_NAME_LEAD_ECONOMIST = "Ведущий экономист"
ROLE_NAME_ECONOMIST = "Экономист"
ROLE_NAME_OPERATOR = "Оператор"

class UserRegistrationService:
    def __init__(self, users: UserRepository):
        self._users = users

    async def register_user(
        self,
        current_user: CurrentUser,
        *,
        user_id: str,
        password: str,
        role_id: int,
        id_parent: str | None,
        full_name: str | None,
        phone: str | None,
        mail: str | None,
    ) -> User:
        UserPolicy.can_register_user(current_user)
        target_role = await self._users.get_role_by_id(role_id)
        if target_role is None:
            raise Conflict("Role is not allowed for creation")
        if current_user.role_id == settings.superadmin_role_id and role_id == settings.superadmin_role_id:
            raise Forbidden("Superadmin cannot create superadmin users")
        if current_user.role_id in {settings.lead_economist_role_id, settings.project_manager_role_id} and role_id != settings.economist_role_id:
            raise Forbidden("Lead economist and project manager can create only economist users")
        current_role = await self._users.get_role_by_id(current_user.role_id)
        if current_role is None:
            raise Forbidden("Access denied")

        if current_role.role not in {
            ROLE_NAME_SUPERADMIN,
            ROLE_NAME_ADMIN,
            ROLE_NAME_LEAD_ECONOMIST,
            ROLE_NAME_PROJECT_MANAGER,
        }:
            raise Forbidden("Access denied")

        if target_role.role == ROLE_NAME_SUPERADMIN:
            raise Forbidden("Superadmin cannot create superadmin users")

        if current_role.role == ROLE_NAME_ADMIN and target_role.role not in {
            ROLE_NAME_ECONOMIST,
            ROLE_NAME_OPERATOR,
        }:
            raise Forbidden("Admin can create only economist and operator users")

        if current_role.role in {ROLE_NAME_LEAD_ECONOMIST, ROLE_NAME_PROJECT_MANAGER} and target_role.role != ROLE_NAME_ECONOMIST:
            raise Forbidden("Lead economist and project manager can create only economist users")
        if target_role.role == ROLE_NAME_ECONOMIST:
            if id_parent is None:
                raise Conflict("Economist user must have a lead economist manager")
            parent_user = await self._users.get_by_id(id_parent)
            if parent_user is None:
                raise NotFound("Parent user not found")
            parent_role = await self._users.get_role_by_id(parent_user.id_role)
            if parent_role is None or parent_role.role != ROLE_NAME_LEAD_ECONOMIST:
                raise Conflict("Economist user can have only lead economist manager")
        elif target_role.role == ROLE_NAME_LEAD_ECONOMIST:
            if id_parent is None:
                raise Conflict("Lead economist user must have a project manager")
            parent_user = await self._users.get_by_id(id_parent)
            if parent_user is None:
                raise NotFound("Parent user not found")
            parent_role = await self._users.get_role_by_id(parent_user.id_role)
            if parent_role is None or parent_role.role != ROLE_NAME_PROJECT_MANAGER:
                raise Conflict("Lead economist user can have only project manager")
        else:
            id_parent = None
        if await self._users.exists(user_id):
            raise Conflict("User already exists")
        
        password_hash = await hash_password(password)
        user = User(
            id=user_id,
            password_hash=password_hash,
            id_role=role_id,
            id_parent=id_parent,
            status="active",
        )

        await self._users.add(user)
        return user
    

class ContractorRegistrationService:
    def __init__(
        self,
        users: UserRepository,
        profiles: ProfileRepository,
        company_contacts: CompanyContactRepository,
        tg_users: TgUserRepository,
    ) -> None:
        self._users = users
        self._profiles = profiles
        self._company_contacts = company_contacts
        self._tg_users = tg_users

    async def register_contractor(
        self,
        *,
        tg_user_id: int,
        login: str,
        password: str,
        full_name: str,
        phone: str,
        mail: str,
        company_name: str,
        inn: str,
        company_phone: str,
        company_mail: str,
        address: str,
        note: str,
    ) -> User:
        tg_user = await self._tg_users.get_by_id(tg_user_id)
        if tg_user is None:
            raise NotFound("TG user not found")
        if await self._users.exists(login):
            raise Conflict("User already exists")
        existing_by_tg = await self._users.get_by_tg_user_id(tg_user_id)
        if existing_by_tg is not None:
            raise Conflict("TG user already linked")

        password_hash = await hash_password(password)
        user = User(
            id=login,
            password_hash=password_hash,
            id_role=settings.contractor_role_id,
            status="review",
            tg_user_id=tg_user_id,
        )
        profile = Profile(
            id=login,
            full_name=full_name,
            phone=phone,
            mail=mail,
        )
        company_contact = CompanyContact(
            id=login,
            company_name=company_name,
            inn=inn,
            phone=company_phone,
            mail=company_mail,
            address=address,
            note=note,
        )
        await self._users.add(user)
        await self._profiles.add(profile)
        await self._company_contacts.add(company_contact)
        return user


@dataclass(frozen=True)
class UserListItem:
    user_id: str
    role_id: int
    status: str
    full_name: str | None
    phone: str | None
    mail: str | None
    tg_user_id: int | None = None
    tg_status: str | None = None
    company_name: str | None = None
    inn: str | None = None
    company_phone: str | None = None
    company_mail: str | None = None
    address: str | None = None
    note: str | None = None


@dataclass(frozen=True)
class EconomistListItem:
    user_id: str
    status: str
    full_name: str | None
    phone: str | None
    mail: str | None


@dataclass(frozen=True)
class RequestEconomistListItem:
    user_id: str
    full_name: str | None
    role: str


@dataclass(frozen=True)
class UserStatusUpdateResult:
    user_id: str
    user_status: str
    tg_user_id: int | None
    tg_status: str | None


@dataclass(frozen=True)
class MeResult:
    user_id: str
    role_id: int
    status: str
    tg_user_id: int | None
    full_name: str | None
    phone: str | None
    mail: str | None
    company_name: str | None = None
    inn: str | None = None
    company_phone: str | None = None
    company_mail: str | None = None
    address: str | None = None
    note: str | None = None

class UserQueryService:
    def __init__(self, users: UserRepository):
        self._users = users

    async def list_users(self, current_user: CurrentUser, role_id: int | None = None) -> list[UserListItem]:
        UserPolicy.can_list_users(current_user)

        if current_user.role_id in {settings.lead_economist_role_id, settings.project_manager_role_id}:
            if role_id is not None and role_id != settings.economist_role_id:
                raise Forbidden("Lead economist and project manager can view only economist users")
            role_id = settings.economist_role_id

        if role_id == settings.contractor_role_id:
            rows = await self._users.list_contractors(contractor_role_id=settings.contractor_role_id)
            return [
                UserListItem(
                    user_id=user.id,
                    role_id=user.id_role,
                    status=user.status,
                    full_name=profile.full_name if profile else None,
                    phone=profile.phone if profile else None,
                    mail=profile.mail if profile else None,
                    tg_user_id=user.tg_user_id,
                    tg_status=tg_user.status if tg_user else None,
                    company_name=company.company_name if company else None,
                    inn=company.inn if company else None,
                    company_phone=company.phone if company else None,
                    company_mail=company.mail if company else None,
                    address=company.address if company else None,
                    note=company.note if company else None,
                )
                for user, profile, company, tg_user in rows
            ]

        rows = await self._users.list_users_with_profiles(role_id=role_id)
        return [
            UserListItem(
                user_id=user.id,
                role_id=user.id_role,
                status=user.status,
                full_name=profile.full_name if profile else None,
                phone=profile.phone if profile else None,
                mail=profile.mail if profile else None,
            )
            for user, profile in rows
        ]
    
    async def list_economists(self, current_user: CurrentUser) -> list[EconomistListItem]:
        UserPolicy.can_list_users(current_user)

        rows = await self._users.list_users_with_profiles(role_id=settings.economist_role_id)
        return [
            EconomistListItem(
                user_id=user.id,
                status=user.status,
                full_name=profile.full_name if profile else None,
                phone=profile.phone if profile else None,
                mail=profile.mail if profile else None,
            )
            for user, profile in rows
        ]
    
    async def list_request_economists(self, current_user: CurrentUser) -> list[RequestEconomistListItem]:
        UserPolicy.can_manage_requests(current_user)

        rows = await self._users.list_by_role_ids_with_profiles_and_roles(
            role_ids=[settings.lead_economist_role_id, settings.economist_role_id],
        )
        return [
            RequestEconomistListItem(
                user_id=user.id,
                full_name=profile.full_name if profile else None,
                role=role.role,
            )
            for user, profile, role in rows
        ]
    
    async def get_me(self, current_user: CurrentUser) -> MeResult:
        UserPolicy.can_manage_own_profile(current_user)

        row = await self._users.get_with_profile_and_company_contacts(user_id=current_user.user_id)
        if row is None:
            raise NotFound("User not found")

        user, profile, company_contact = row

        return MeResult(
            user_id=user.id,
            role_id=user.id_role,
            status=user.status,
            tg_user_id=user.tg_user_id,
            full_name=profile.full_name if profile else None,
            phone=profile.phone if profile else None,
            mail=profile.mail if profile else None,
            company_name=company_contact.company_name if company_contact else None,
            inn=company_contact.inn if company_contact else None,
            company_phone=company_contact.phone if company_contact else None,
            company_mail=company_contact.mail if company_contact else None,
            address=company_contact.address if company_contact else None,
            note=company_contact.note if company_contact else None,
        )

@dataclass(frozen=True)
class UserRoleUpdateResult:
    user_id: str
    role_id: int


class UserRoleService:
    def __init__(self, users: UserRepository):
        self._users = users

    async def update_role(
        self,
        *,
        current_user: CurrentUser,
        user_id: str,
        role_id: int,
    ) -> UserRoleUpdateResult:
        UserPolicy.can_update_user_role(current_user)

        if role_id not in {settings.admin_role_id, settings.economist_role_id}:
            raise Conflict("Only admin and economist roles are allowed for update")

        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFound("User not found")

        if user.id_role == settings.superadmin_role_id:
            raise Forbidden("Superadmin role cannot be changed")

        await self._users.update_role(user, role_id)
        return UserRoleUpdateResult(user_id=user.id, role_id=user.id_role)


class UserStatusService:
    VALID_USER_STATUSES = {"active", "inactive", "review", "blacklist"}
    VALID_TG_STATUSES = {"approved", "disapproved", "review"}

    def __init__(self, users: UserRepository, tg_users: TgUserRepository):
        self._users = users
        self._tg_users = tg_users

    async def update_statuses(
        self,
        *,
        current_user: CurrentUser,
        user_id: str,
        user_status: str,
        tg_status: str | None,
    ) -> UserStatusUpdateResult:
        UserPolicy.can_update_user_status(current_user)

        if user_status not in self.VALID_USER_STATUSES:
            raise Conflict("Unsupported users.status value")
        if tg_status is not None and tg_status not in self.VALID_TG_STATUSES:
            raise Conflict("Unsupported tg_users.status value")

        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFound("User not found")
        
        if current_user.role_id in {settings.lead_economist_role_id, settings.project_manager_role_id} and user.id_role != settings.economist_role_id:
            raise Forbidden("Lead economist and project manager can update status only for economist users")

        tg_user: TgUser | None = None
        if user.tg_user_id is not None:
            tg_user = await self._tg_users.get_by_id(user.tg_user_id)

        if tg_status is not None:
            if tg_user is None:
                raise Conflict("User has no linked Telegram account")
            await self._tg_users.update_status(tg_user, tg_status)

        if tg_user is not None and tg_status is None:
            if user_status in {"inactive", "blacklist"}:
                await self._tg_users.update_status(tg_user, "disapproved")
            elif user_status == "active":
                await self._tg_users.update_status(tg_user, "approved")

        await self._users.update_status(user, user_status)

        notify_tg_id = tg_user.id if tg_user is not None else None

        result = UserStatusUpdateResult(
            user_id=user.id,
            user_status=user.status,
            tg_user_id=user.tg_user_id,
            tg_status=tg_user.status if tg_user else None,
        )

        if notify_tg_id is not None and tg_user is not None:
            if user.status == "active" and tg_user.status == "approved":
                await notify_access_opened(notify_tg_id)
            else:
                await notify_access_closed(notify_tg_id)

        return result
    
class UserSelfService:
    def __init__(
        self,
        users: UserRepository,
        profiles: ProfileRepository,
        company_contacts: CompanyContactRepository,
    ):
        self._users = users
        self._profiles = profiles
        self._company_contacts = company_contacts

    async def update_my_credentials(
        self,
        current_user: CurrentUser,
        *,
        current_password: str,
        new_password: str,
    ) -> None:
        UserPolicy.can_manage_own_profile(current_user)

        user = await self._users.get_by_id(current_user.user_id)
        if user is None:
            raise NotFound("User not found")

        is_valid_current_password = await verify_password(current_password, user.password_hash)
        if not is_valid_current_password:
            raise Forbidden("Current password is invalid")

        user.password_hash = await hash_password(new_password)

    async def update_my_profile(
        self,
        current_user: CurrentUser,
        *,
        full_name: str | None,
        phone: str | None,
        mail: str | None,
    ) -> None:
        UserPolicy.can_manage_own_profile(current_user)

        profile = await self._profiles.get_by_id(current_user.user_id)
        if profile is None:
            await self._profiles.add(
                Profile(
                    id=current_user.user_id,
                    full_name=full_name or "Не указано",
                    phone=phone or "Не указано",
                    mail=mail or "Не указано",
                )
            )
            return

        if full_name is not None:
            profile.full_name = full_name
        if phone is not None:
            profile.phone = phone
        if mail is not None:
            profile.mail = mail

    async def update_my_company_contacts(
        self,
        current_user: CurrentUser,
        *,
        company_name: str | None,
        inn: str | None,
        company_phone: str | None,
        company_mail: str | None,
        address: str | None,
        note: str | None,
    ) -> None:
        UserPolicy.can_manage_own_company_contacts(current_user)

        company_contacts = await self._company_contacts.get_by_id(current_user.user_id)
        if company_contacts is None:
            raise NotFound("Company contacts not found")

        if company_name is not None:
            company_contacts.company_name = company_name
        if inn is not None:
            company_contacts.inn = inn
        if company_phone is not None:
            company_contacts.phone = company_phone
        if company_mail is not None:
            company_contacts.mail = company_mail
        if address is not None:
            company_contacts.address = address
        if note is not None:
            company_contacts.note = note