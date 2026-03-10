import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.links import LinkSet

class ContractorEmailVerificationRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Signed Telegram token for contractor registration")
    mail: str = Field(..., min_length=1, max_length=256)

    @field_validator("mail")
    @classmethod
    def _validate_mail(cls, value: str) -> str:
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError("Invalid email format")
        return value

class ContractorRegistrationRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Signed Telegram token for contractor registration")
    email_verification_token: str = Field(..., min_length=1, description="Signed email verification token")
    login: str = Field(..., min_length=3, max_length=128)
    password: str = Field(..., min_length=6, max_length=72)
    password_confirm: str = Field(..., min_length=6, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=256)
    phone: str = Field(..., min_length=1, max_length=64)
    company_name: str = Field(..., min_length=1, max_length=256)
    inn: str = Field(..., min_length=1, max_length=32)
    company_phone: str = Field(..., min_length=1, max_length=64)
    company_mail: str = Field(default="Не указано", max_length=256)
    address: str = Field(default="Не указано", max_length=256)
    note: str = Field(default="Не указано", max_length=1024)

    @field_validator("password")
    @classmethod
    def _validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password too long (max 72 bytes)")
        return value

    @field_validator("password_confirm")
    @classmethod
    def _validate_password_confirm_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password too long (max 72 bytes)")
        return value

    @field_validator("password_confirm")
    @classmethod
    def _validate_password_match(cls, value: str, info) -> str:
        if "password" in info.data and value != info.data["password"]:
            raise ValueError("Passwords do not match")
        return value

    @field_validator("phone", "company_phone")
    @classmethod
    def _validate_ru_phone(cls, value: str) -> str:
        normalized = re.sub(r"\D", "", value)
        if len(normalized) != 11 or normalized[0] not in {"7", "8"}:
            raise ValueError("Invalid phone format")
        return value


    @field_validator("company_mail")
    @classmethod
    def _validate_company_mail(cls, value: str) -> str:
        if value == "Не указано":
            return value
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError("Invalid email format")
        return value

    @field_validator("inn")
    @classmethod
    def _validate_inn(cls, value: str) -> str:
        if not re.match(r"^\d{10}$|^\d{12}$", value):
            raise ValueError("Invalid INN format")
        return value


class ContractorRegistrationData(BaseModel):
    user_id: str
    status: str
    tg_user_id: int


class ContractorRegistrationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: ContractorRegistrationData
    links: LinkSet = Field(alias="_links")
