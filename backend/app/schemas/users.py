from pydantic import BaseModel, ConfigDict, Field

from app.schemas.links import LinkSet


class UserListItemSchema(BaseModel):
    user_id: str
    role_id: int
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


class UserListData(BaseModel):
    items: list[UserListItemSchema]


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


class EconomistListData(BaseModel):
    items: list[EconomistListItemSchema]


class EconomistListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: EconomistListData
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


class RequestEconomistListData(BaseModel):
    items: list[RequestEconomistItemSchema]


class RequestEconomistListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestEconomistListData
    links: LinkSet = Field(alias="_links")


class MeData(BaseModel):
    user_id: str
    role_id: int
    status: str
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


class MeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: MeData
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