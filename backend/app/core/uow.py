from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import SessionLocal
from app.repositories.files import FileRepository
from app.repositories.messages import MessageRepository
from app.repositories.offers import OfferRepository
from app.repositories.company_contacts import CompanyContactRepository
from app.repositories.feedback import FeedBackRepository
from app.repositories.profiles import ProfileRepository
from app.repositories.requests import RequestRepository
from app.repositories.tg_users import TgUserRepository
from app.repositories.users import UserRepository
from app.repositories.user_status_periods import UserStatusPeriodRepository


class UnitOfWork:
    def __init__(self, session_factory: Callable[[], AsyncSession] = SessionLocal):
        self._session_factory = session_factory
        self.session: AsyncSession | None = None
        self.users: UserRepository | None = None
        self.profiles: ProfileRepository | None = None
        self.company_contacts: CompanyContactRepository | None = None
        self.tg_users: TgUserRepository | None = None
        self.requests: RequestRepository | None = None
        self.files: FileRepository | None = None
        self.offers: OfferRepository | None = None
        self.messages: MessageRepository | None = None
        self.feedback: FeedBackRepository | None = None
        self.user_status_periods: UserStatusPeriodRepository | None = None

    async def __aenter__(self) -> "UnitOfWork":
        self.session = self._session_factory()
        await self.session.begin()
        self.users = UserRepository(self.session)
        self.profiles = ProfileRepository(self.session)
        self.company_contacts = CompanyContactRepository(self.session)
        self.tg_users = TgUserRepository(self.session)
        self.requests = RequestRepository(self.session)
        self.files = FileRepository(self.session)
        self.offers = OfferRepository(self.session)
        self.messages = MessageRepository(self.session)
        self.feedback = FeedBackRepository(self.session)
        self.user_status_periods = UserStatusPeriodRepository(self.session)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self.session:
            return
        if exc:
            await self.session.rollback()
        else:
            await self.session.commit()
        await self.session.close()