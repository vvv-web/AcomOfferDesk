from __future__ import annotations

from typing import Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Integer,
    SmallInteger,
    Text,
    TIMESTAMP,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    role: Mapped[str] = mapped_column(Text, unique=True, nullable=False)


class TgUser(Base):
    __tablename__ = "tg_users"
    __table_args__ = (
        CheckConstraint("status IN ('approved','disapproved','review')", name="tg_users_status_check"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="review")



class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active','inactive','review','blacklist')",
            name="users_status_check",
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    id_role: Mapped[int] = mapped_column(SmallInteger, ForeignKey("roles.id"), nullable=False)
    id_parent: Mapped[Optional[str]] = mapped_column(
        Text,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="review")
    tg_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("tg_users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    profile: Mapped[Optional[Profile]] = relationship(
        "Profile",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    company_contact: Mapped[Optional[CompanyContact]] = relationship(
        "CompanyContact",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    tg_user: Mapped[Optional[TgUser]] = relationship("TgUser", uselist=False)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(Text, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)
    mail: Mapped[str] = mapped_column(Text, nullable=False, server_default="Не указано")

    user: Mapped[User] = relationship("User", back_populates="profile")


class CompanyContact(Base):
    __tablename__ = "company_contacts"

    id: Mapped[str] = mapped_column(Text, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_name: Mapped[str] = mapped_column(Text, nullable=False)
    inn: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)
    mail: Mapped[str] = mapped_column(Text, nullable=False, server_default="Не указано")
    address: Mapped[str] = mapped_column(Text, nullable=False, server_default="Не указано")
    note: Mapped[str] = mapped_column(Text, nullable=False, server_default="Не указано")

    user: Mapped[User] = relationship("User", back_populates="company_contact")


class File(Base):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class Request(Base):
    __tablename__ = "requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','review','closed','cancelled')",
            name="requests_status_check",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="open")
    deadline_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    closed_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP, nullable=True)
    
    id_offer: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("offers.id", ondelete="SET NULL"),
        nullable=True,
    )

    id_user: Mapped[str] = mapped_column(Text, ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())

    offers: Mapped[list["Offer"]] = relationship(
        "Offer",
        back_populates="request",
        foreign_keys="Offer.id_request",
        cascade="all, delete-orphan",
    )

    chosen_offer: Mapped[Optional["Offer"]] = relationship(
        "Offer",
        foreign_keys=[id_offer],
        post_update=True,
    )


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted','deleted','accepted','rejected')",
            name="offers_status_check",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_request: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("requests.id", ondelete="CASCADE"),
    )
    id_user: Mapped[str] = mapped_column(Text, ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="submitted")
    created_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())

    request: Mapped["Request"] = relationship(
        "Request",
        back_populates="offers",
        foreign_keys=[id_request],
    )
    chat: Mapped[Optional[Chat]] = relationship("Chat", back_populates="offer", uselist=False)


class RequestOfferStats(Base):
    __tablename__ = "request_offer_stats"

    request_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("requests.id", ondelete="CASCADE"),
        primary_key=True,
    )
    count_submitted: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    count_deleted_alert: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    count_accepted_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    count_rejected_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    updated_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("offers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    last_message_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    last_message_at: Mapped[Optional[str]] = mapped_column(TIMESTAMP, nullable=True)

    offer: Mapped[Offer] = relationship("Offer", back_populates="chat")
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="chat",
        foreign_keys="Message.id_chat",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    last_message: Mapped[Optional["Message"]] = relationship(
        "Message",
        foreign_keys=[last_message_id],
        post_update=True,
        uselist=False,
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint(
            "status IN ('send','received','read')",
            name="messages_status_check",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_chat: Mapped[int] = mapped_column(BigInteger, ForeignKey("chats.id", ondelete="CASCADE"))
    id_user: Mapped[str] = mapped_column(Text, ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at: Mapped[str] = mapped_column(TIMESTAMP, nullable=False, server_default=func.now())
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="send")

    chat: Mapped["Chat"] = relationship(
        "Chat",
        back_populates="messages",
        foreign_keys=[id_chat],
    )


class RequestFile(Base):
    __tablename__ = "request_files"

    id: Mapped[int] = mapped_column(BigInteger, ForeignKey("files.id", ondelete="RESTRICT"), primary_key=True)
    id_request: Mapped[int] = mapped_column(BigInteger, ForeignKey("requests.id", ondelete="CASCADE"))


class OfferFile(Base):
    __tablename__ = "offer_files"

    id: Mapped[int] = mapped_column(BigInteger, ForeignKey("files.id", ondelete="RESTRICT"), primary_key=True)
    id_offer: Mapped[int] = mapped_column(BigInteger, ForeignKey("offers.id", ondelete="CASCADE"))


class MessageFile(Base):
    __tablename__ = "message_files"

    id: Mapped[int] = mapped_column(BigInteger, ForeignKey("files.id", ondelete="RESTRICT"), primary_key=True)
    id_message: Mapped[int] = mapped_column(BigInteger, ForeignKey("messages.id", ondelete="CASCADE"))


class FeedBack(Base):
    __tablename__ = "feed_back"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)