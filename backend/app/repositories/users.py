from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import CompanyContact, Profile, Role, TgUser, User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, user_id: str) -> User | None:
        return await self._session.get(User, user_id)
    
    async def get_role_by_id(self, role_id: int) -> Role | None:
        result = await self._session.execute(select(Role).where(Role.id == role_id))
        return result.scalar_one_or_none()

    async def get_by_tg_user_id(self, tg_user_id: int) -> User | None:
        result = await self._session.execute(select(User).where(User.tg_user_id == tg_user_id))
        return result.scalar_one_or_none()
    
    async def exists(self, user_id: str) -> bool:
        result = await self._session.execute(select(User.id).where(User.id == user_id))
        return result.scalar_one_or_none() is not None

    async def add(self, user: User) -> None:
        self._session.add(user)

    async def list_subordinates_with_profiles(self, *, manager_user_id: str) -> list[tuple[User, Profile | None]]:
        stmt = (
            select(User, Profile)
            .outerjoin(Profile, Profile.id == User.id)
            .where(User.id_parent == manager_user_id)
            .order_by(User.id)
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def list_users_with_profiles(self, role_id: int | None = None) -> list[tuple[User, Profile | None]]:
        stmt = (
            select(User, Profile)
            .outerjoin(Profile, Profile.id == User.id)
            .order_by(User.id)
        )
        if role_id is not None:
            stmt = stmt.where(User.id_role == role_id)
        result = await self._session.execute(stmt)
        return list(result.all())

    async def list_contractors(
        self,
        contractor_role_id: int,
    ) -> list[tuple[User, Profile | None, CompanyContact | None, TgUser | None]]:
        stmt = (
            select(User, Profile, CompanyContact, TgUser)
            .outerjoin(Profile, Profile.id == User.id)
            .outerjoin(CompanyContact, CompanyContact.id == User.id)
            .outerjoin(TgUser, TgUser.id == User.tg_user_id)
            .where(User.id_role == contractor_role_id)
            .order_by(User.id)
        )
        result = await self._session.execute(stmt)
        return list(result.all())
    
    async def list_by_role_ids_with_profiles_and_roles(
        self,
        *,
        role_ids: list[int],
    ) -> list[tuple[User, Profile | None, Role]]:
        stmt = (
            select(User, Profile, Role)
            .join(Role, Role.id == User.id_role)
            .outerjoin(Profile, Profile.id == User.id)
            .where(User.id_role.in_(role_ids))
            .order_by(User.id_role.asc(), User.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def list_staff_with_profiles_and_roles_for_dashboard(
        self,
        *,
        role_ids: list[int],
    ) -> list[tuple[User, Profile | None, Role]]:
        stmt = (
            select(User, Profile, Role)
            .join(Role, Role.id == User.id_role)
            .outerjoin(Profile, Profile.id == User.id)
            .where(User.id_role.in_(role_ids), User.status == "active")
            .order_by(User.id_role.asc(), User.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.all())

    async def get_with_profile_and_company_contacts(
        self,
        *,
        user_id: str,
    ) -> tuple[User, Profile | None, CompanyContact | None] | None:
        stmt = (
            select(User, Profile, CompanyContact)
            .outerjoin(Profile, Profile.id == User.id)
            .outerjoin(CompanyContact, CompanyContact.id == User.id)
            .where(User.id == user_id)
        )
        result = await self._session.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return None
        return row

    async def update_status(self, user: User, status: str) -> None:
        user.status = status

    async def update_role(self, user: User, role_id: int) -> None:
        user.id_role = role_id

    async def get_active_approved_contractor_tg_id(self, *, user_id: str, contractor_role_id: int) -> int | None:
        stmt = (
            select(TgUser.id)
            .join(User, User.tg_user_id == TgUser.id)
            .where(User.id == user_id)
            .where(User.id_role == contractor_role_id)
            .where(User.status == "active")
            .where(TgUser.status == "approved")
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_active_approved_contractor_tg_ids(
        self,
        *,
        contractor_role_id: int,
        exclude_user_ids: list[str] | None = None,
    ) -> list[int]:
        stmt = (
            select(TgUser.id)
            .join(User, User.tg_user_id == TgUser.id)
            .where(User.id_role == contractor_role_id)
            .where(User.status == "active")
            .where(TgUser.status == "approved")
            .order_by(User.id.asc())
        )
        if exclude_user_ids:
            stmt = stmt.where(User.id.not_in(exclude_user_ids))
        result = await self._session.execute(stmt)
        return list(result.scalars().all())


    async def list_active_tg_user_ids(self) -> list[int]:
        stmt = (
            select(User.tg_user_id)
            .where(User.status == "active")
            .where(User.tg_user_id.is_not(None))
            .order_by(User.id)
        )
        result = await self._session.execute(stmt)
        return [tg_user_id for tg_user_id in result.scalars().all() if tg_user_id is not None]
