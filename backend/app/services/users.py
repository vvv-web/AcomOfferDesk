from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.domain.exceptions import Conflict, Forbidden, NotFound
from app.domain.policies import CurrentUser, UserPolicy
from app.models.orm_models import CompanyContact, Profile, TgUser, User, UserStatusPeriod
from app.repositories.company_contacts import CompanyContactRepository
from app.repositories.profiles import ProfileRepository
from app.repositories.tg_users import TgUserRepository
from app.repositories.user_status_periods import UserStatusPeriodRepository
from app.repositories.users import UserRepository
from app.services.tg_notifications import notify_access_closed, notify_access_opened

ROLE_NAME_SUPERADMIN = "Суперадмин"
ROLE_NAME_ADMIN = "Администратор"
ROLE_NAME_PROJECT_MANAGER = "Руководитель Проекта"
ROLE_NAME_LEAD_ECONOMIST = "Ведущий экономист"
ROLE_NAME_ECONOMIST = "Экономист"
ROLE_NAME_OPERATOR = "Оператор"

def _normalize_db_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)

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
                raise Conflict("Economist user must have an economist or lead economist manager")
            parent_user = await self._users.get_by_id(id_parent)
            if parent_user is None:
                raise NotFound("Parent user not found")
            parent_role = await self._users.get_role_by_id(parent_user.id_role)
            if parent_role is None or parent_role.role not in {ROLE_NAME_ECONOMIST, ROLE_NAME_LEAD_ECONOMIST}:
                raise Conflict("Economist user can have only economist or lead economist manager")
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
            mail="Не указано",
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
    id_parent: str | None
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
    unavailable_period: UnavailabilityPeriodData | None = None


@dataclass(frozen=True)
class UserStatusUpdateResult:
    user_id: str
    user_status: str
    tg_user_id: int | None
    tg_status: str | None


@dataclass(frozen=True)
class UnavailabilityPeriodData:
    id: int
    status: str
    started_at: datetime
    ended_at: datetime


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
    unavailable_period: UnavailabilityPeriodData | None = None
    unavailable_periods: list[UnavailabilityPeriodData] = field(default_factory=list)

@dataclass(frozen=True)
class SubordinateProfileResult:
    user_id: str
    role_id: int
    status: str
    full_name: str | None
    phone: str | None
    mail: str | None
    unavailable_period: UnavailabilityPeriodData | None = None
    unavailable_periods: list[UnavailabilityPeriodData] = field(default_factory=list)

class UserQueryService:
    def __init__(self, users: UserRepository, user_status_periods: UserStatusPeriodRepository):
        self._users = users
        self._user_status_periods = user_status_periods

    async def list_users(self, current_user: CurrentUser, role_id: int | None = None) -> list[UserListItem]:
        UserPolicy.can_list_users(current_user)

        if current_user.role_id in {
            settings.lead_economist_role_id,
            settings.project_manager_role_id,
            settings.economist_role_id,
        }:
            if role_id is not None and role_id != settings.economist_role_id:
                raise Forbidden("Project manager, lead economist and economist can view only economist users")
            role_id = settings.economist_role_id

        if current_user.role_id == settings.economist_role_id:
            rows = await self._users.list_subordinates_with_profiles(manager_user_id=current_user.user_id)
            return [
                UserListItem(
                    user_id=user.id,
                    role_id=user.id_role,
                    id_parent=user.id_parent,
                    status=user.status,
                    full_name=profile.full_name if profile else None,
                    phone=profile.phone if profile else None,
                    mail=profile.mail if profile else None,
                )
                for user, profile in rows
                if user.id_role == settings.economist_role_id
            ]
        
        if role_id == settings.contractor_role_id:
            rows = await self._users.list_contractors(contractor_role_id=settings.contractor_role_id)
            return [
                UserListItem(
                    user_id=user.id,
                    role_id=user.id_role,
                    id_parent=user.id_parent,
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
                id_parent=user.id_parent,
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
        user_ids = [user.id for user, _, _ in rows]
        active_unavailability_by_user = await self._user_status_periods.list_active_for_users(user_ids=user_ids)

        return [
            RequestEconomistListItem(
                user_id=user.id,
                full_name=profile.full_name if profile else None,
                role=role.role,
                unavailable_period=self._period_to_data(active_unavailability_by_user[user.id]) if user.id in active_unavailability_by_user else None,
            )
            for user, profile, role in rows
        ]
    
    def _period_to_data(self, period: UserStatusPeriod) -> UnavailabilityPeriodData:
        return UnavailabilityPeriodData(
            id=period.id,
            status=period.status,
            started_at=period.started_at,
            ended_at=period.ended_at,
        )

    async def get_subordinate_profile(
        self,
        *,
        current_user: CurrentUser,
        subordinate_user_id: str,
    ) -> SubordinateProfileResult:
        UserPolicy.can_manage_subordinate_unavailability(current_user)

        subordinate = await self._users.get_by_id(subordinate_user_id)
        if subordinate is None:
            raise NotFound("User not found")

        if subordinate.id_parent != current_user.user_id:
            raise Forbidden("You can manage unavailability period only for direct subordinates")

        if subordinate.id_role not in {
            settings.lead_economist_role_id,
            settings.economist_role_id,
        }:
            raise Conflict("Unavailability period can be managed only for lead economist and economist users")

        rows = await self._users.list_subordinates_with_profiles(manager_user_id=current_user.user_id)
        profile = None
        for user, user_profile in rows:
            if user.id == subordinate_user_id:
                profile = user_profile
                break

        unavailable_period = await self._user_status_periods.get_active_for_user(user_id=subordinate_user_id)
        unavailable_periods = await self._user_status_periods.list_for_user(user_id=subordinate_user_id)

        return SubordinateProfileResult(
            user_id=subordinate.id,
            role_id=subordinate.id_role,
            status=subordinate.status,
            full_name=profile.full_name if profile else None,
            phone=profile.phone if profile else None,
            mail=profile.mail if profile else None,
            unavailable_period=self._period_to_data(unavailable_period) if unavailable_period is not None else None,
            unavailable_periods=[self._period_to_data(period) for period in unavailable_periods],
        )
    
    async def get_me(self, current_user: CurrentUser) -> MeResult:
        UserPolicy.can_manage_own_profile(current_user)

        row = await self._users.get_with_profile_and_company_contacts(user_id=current_user.user_id)
        if row is None:
            raise NotFound("User not found")

        user, profile, company_contact = row
        unavailable_period = await self._user_status_periods.get_active_for_user(user_id=current_user.user_id)
        unavailable_periods = await self._user_status_periods.list_for_user(user_id=current_user.user_id)

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
            unavailable_period=self._period_to_data(unavailable_period) if unavailable_period is not None else None,
            unavailable_periods=[self._period_to_data(period) for period in unavailable_periods],
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
    VALID_UNAVAILABILITY_STATUSES = {"sick", "vacation", "fired", "maternity", "business_trip", "unavailable"}

    def __init__(
        self,
        users: UserRepository,
        profiles: ProfileRepository,
        company_contacts: CompanyContactRepository,
        user_status_periods: UserStatusPeriodRepository,
    ):
        self._users = users
        self._profiles = profiles
        self._company_contacts = company_contacts
        self._user_status_periods = user_status_periods

    async def _ensure_no_period_overlap(
        self,
        *,
        user_id: str,
        started_at: datetime,
        ended_at: datetime,
    ) -> None:
        overlapping = await self._user_status_periods.get_overlapping_for_user(
            user_id=user_id,
            started_at=started_at,
            ended_at=ended_at,
        )
        if overlapping is not None:
            raise Conflict(
                "User already has unavailability period in this time range "
                f"{overlapping.started_at.isoformat()} - {overlapping.ended_at.isoformat()}"
            )

        existing_periods = await self._user_status_periods.list_for_user(user_id=user_id)
        new_start_date = started_at.date()
        new_end_date = ended_at.date()
        for period in existing_periods:
            period_start_date = period.started_at.date()
            period_end_date = period.ended_at.date()
            has_date_overlap = period_start_date <= new_end_date and period_end_date >= new_start_date
            if has_date_overlap:
                raise Conflict(
                    "User already has unavailability period in this time range "
                    f"{period.started_at.isoformat()} - {period.ended_at.isoformat()}"
                )

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

    async def set_subordinate_unavailability_period(
        self,
        *,
        current_user: CurrentUser,
        subordinate_user_id: str,
        status: str,
        started_at: datetime,
        ended_at: datetime,
    ) -> None:
        UserPolicy.can_manage_subordinate_unavailability(current_user)

        if status not in self.VALID_UNAVAILABILITY_STATUSES:
            raise Conflict("Unsupported user_status_periods.status value")

        normalized_started_at = _normalize_db_timestamp(started_at)
        normalized_ended_at = _normalize_db_timestamp(ended_at)

        if normalized_ended_at < normalized_started_at:
            raise Conflict("Period end date must be greater than or equal to start date")

        subordinate = await self._users.get_by_id(subordinate_user_id)
        if subordinate is None:
            raise NotFound("User not found")

        if subordinate.id_parent != current_user.user_id:
            raise Forbidden("You can manage unavailability period only for direct subordinates")

        if subordinate.id_role not in {
            settings.lead_economist_role_id,
            settings.economist_role_id,
        }:
            raise Conflict("Unavailability period can be managed only for lead economist and economist users")

        await self._ensure_no_period_overlap(
            user_id=subordinate_user_id,
            started_at=normalized_started_at,
            ended_at=normalized_ended_at,
        )

        await self._user_status_periods.add(
            UserStatusPeriod(
                id_user=subordinate_user_id,
                status=status,
                started_at=normalized_started_at,
                ended_at=normalized_ended_at,
            )
        )

    async def set_my_unavailability_period(
        self,
        current_user: CurrentUser,
        *,
        status: str,
        started_at: datetime,
        ended_at: datetime,
    ) -> None:
        UserPolicy.can_manage_own_unavailability(current_user)

        if status not in self.VALID_UNAVAILABILITY_STATUSES:
            raise Conflict("Unsupported user_status_periods.status value")

        normalized_started_at = _normalize_db_timestamp(started_at)
        normalized_ended_at = _normalize_db_timestamp(ended_at)

        if normalized_ended_at < normalized_started_at:
            raise Conflict("Period end date must be greater than or equal to start date")

        user = await self._users.get_by_id(current_user.user_id)
        if user is None:
            raise NotFound("User not found")

        await self._ensure_no_period_overlap(
            user_id=current_user.user_id,
            started_at=normalized_started_at,
            ended_at=normalized_ended_at,
        )

        await self._user_status_periods.add(
            UserStatusPeriod(
                id_user=current_user.user_id,
                status=status,
                started_at=normalized_started_at,
                ended_at=normalized_ended_at,
            )
        )
