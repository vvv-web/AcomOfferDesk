from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.actions import UserActionsSchema
from app.schemas.links import LinkSet


class UserListItemSchema(BaseModel):
    user_id: str
    role_id: int
    id_parent: str | None = None
    status: str
    full_name: str | None = None
    phone: str | None = None
    mail: str | None = None
    tg_user_id: int | None = None
    tg_status: str | None = None
    company_name: str | None = None
    inn: str | None = None
    company_phone: str | None = None
    company_mail: str | None = None
    address: str | None = None
    note: str | None = None
    actions: UserActionsSchema = Field(default_factory=UserActionsSchema)


class UserListData(BaseModel):
    items: list[UserListItemSchema]
    permissions: list[str] = Field(default_factory=list)


class UserListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: UserListData
    links: LinkSet = Field(alias="_links")


class EconomistListItemSchema(BaseModel):
    user_id: str
    status: str
    full_name: str | None = None
    phone: str | None = None
    mail: str | None = None
    actions: UserActionsSchema = Field(default_factory=UserActionsSchema)


class EconomistListData(BaseModel):
    items: list[EconomistListItemSchema]
    permissions: list[str] = Field(default_factory=list)


class EconomistListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: EconomistListData
    links: LinkSet = Field(alias="_links")

    
class UserRoleUpdateRequest(BaseModel):
    role_id: int = Field(ge=1)


class UserRoleUpdateData(BaseModel):
    user_id: str
    role_id: int


class UserRoleUpdateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: UserRoleUpdateData
    links: LinkSet = Field(alias="_links")


class UserManagerUpdateRequest(BaseModel):
    manager_user_id: str = Field(min_length=1)


class UserManagerUpdateData(BaseModel):
    user_id: str
    manager_user_id: str


class UserManagerUpdateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: UserManagerUpdateData
    links: LinkSet = Field(alias="_links")


class UserStatusUpdateRequest(BaseModel):
    user_status: str
    tg_status: str | None = None


class UserStatusUpdateData(BaseModel):
    user_id: str
    user_status: str
    tg_user_id: int | None = None
    tg_status: str | None = None


class UserStatusUpdateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: UserStatusUpdateData
    links: LinkSet = Field(alias="_links")


class RequestEconomistItemSchema(BaseModel):
    user_id: str
    full_name: str | None
    role: str
    unavailable_period: "UserUnavailabilityPeriodSchema | None" = None


class RequestEconomistListData(BaseModel):
    items: list[RequestEconomistItemSchema]
    permissions: list[str] = Field(default_factory=list)


class RequestEconomistListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestEconomistListData
    links: LinkSet = Field(alias="_links")


class RequestContractorItemSchema(BaseModel):
    user_id: str
    full_name: str | None = None
    company_name: str | None = None
    mail: str | None = None
    company_mail: str | None = None


class RequestContractorListData(BaseModel):
    items: list[RequestContractorItemSchema]
    permissions: list[str] = Field(default_factory=list)


class RequestContractorListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestContractorListData
    links: LinkSet = Field(alias="_links")


class UserUnavailabilityPeriodSchema(BaseModel):
    id: int
    status: str
    started_at: datetime
    ended_at: datetime


class MeData(BaseModel):
    user_id: str
    role_id: int
    status: str
    unavailable_period: "UserUnavailabilityPeriodSchema | None" = None
    unavailable_periods: list[UserUnavailabilityPeriodSchema] = Field(default_factory=list)
    tg_user_id: int | None = None
    full_name: str | None = None
    phone: str | None = None
    mail: str | None = None
    company_name: str | None = None
    inn: str | None = None
    company_phone: str | None = None
    company_mail: str | None = None
    address: str | None = None
    note: str | None = None
    permissions: list[str] = Field(default_factory=list)
    actions: UserActionsSchema = Field(default_factory=UserActionsSchema)


class MeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: MeData
    links: LinkSet = Field(alias="_links")


class SubordinateProfileData(BaseModel):
    user_id: str
    role_id: int
    id_parent: str | None = None
    status: str
    full_name: str | None = None
    phone: str | None = None
    mail: str | None = None
    unavailable_period: "UserUnavailabilityPeriodSchema | None" = None
    unavailable_periods: list[UserUnavailabilityPeriodSchema] = Field(default_factory=list)
    actions: UserActionsSchema = Field(default_factory=UserActionsSchema)


class SubordinateProfileResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: SubordinateProfileData
    links: LinkSet = Field(alias="_links")


class SetSubordinateUnavailabilityPeriodRequest(BaseModel):
    status: str
    started_at: datetime
    ended_at: datetime


class SetSubordinateUnavailabilityPeriodResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: SubordinateProfileData
    links: LinkSet = Field(alias="_links")


class UpdateMyCredentialsRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=255)
    new_password: str = Field(min_length=8, max_length=255)


class UpdateMyProfileRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    mail: str | None = None


class UpdateMyCompanyContactsRequest(BaseModel):
    company_name: str | None = None
    inn: str | None = None
    company_phone: str | None = None
    company_mail: str | None = None
    address: str | None = None
    note: str | None = None


class SetMyUnavailabilityPeriodRequest(BaseModel):
    status: str
    started_at: datetime
    ended_at: datetime


class SetMyUnavailabilityPeriodResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: MeData
    links: LinkSet = Field(alias="_links")
