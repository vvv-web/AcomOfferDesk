from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.links import LinkSet


class RequestFileSchema(BaseModel):
    id: int
    path: str
    name: str
    download_url: str


class RequestStatsSchema(BaseModel):
    count_submitted: int
    count_deleted_alert: int
    count_accepted_total: int
    count_rejected_total: int


class OfferItemSchema(BaseModel):
    offer_id: int
    contractor_user_id: str
    status: str
    status_label: str
    created_at: datetime
    updated_at: datetime
    offer_workspace_url: str
    contractor_full_name: str | None
    contractor_phone: str | None
    contractor_mail: str | None
    contractor_inn: str | None
    contractor_company_name: str | None
    contractor_company_phone: str | None
    contractor_company_mail: str | None
    contractor_contact_phone: str | None
    contractor_contact_mail: str | None
    contractor_address: str | None
    contractor_note: str | None
    files: list[RequestFileSchema]
    unread_messages_count: int


class RequestItemSchema(BaseModel):
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    owner_user_id: str
    chosen_offer_id: int | None
    stats: RequestStatsSchema
    unread_messages_count: int
    files: list[RequestFileSchema]


class RequestDetailsSchema(RequestItemSchema):
    offers: list[OfferItemSchema]


class OfferedRequestOfferSchema(BaseModel):
    id: int = Field(alias="offer_id")
    status: str
    unread_messages_count: int

class OpenRequestItemSchema(BaseModel):
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    owner_user_id: str
    chosen_offer_id: int | None
    files: list[RequestFileSchema]
    offers: list[OfferedRequestOfferSchema] = Field(default_factory=list)


class OpenRequestListData(BaseModel):
    items: list[OpenRequestItemSchema]


class RequestListData(BaseModel):
    items: list[RequestItemSchema]


class RequestDetailsResponseData(BaseModel):
    item: RequestDetailsSchema


class RequestListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestListData
    links: LinkSet = Field(alias="_links")


class RequestDetailsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestDetailsResponseData
    links: LinkSet = Field(alias="_links")


class OpenRequestListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OpenRequestListData
    links: LinkSet = Field(alias="_links")


class RequestCreateResponseData(BaseModel):
    request_id: int
    file_ids: list[int]


class RequestCreateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestCreateResponseData
    links: LinkSet = Field(alias="_links")


class DeletedAlertViewed(BaseModel):
    request_id: int


class RequestOfferStatsSchema(BaseModel):
    request_id: int
    count_deleted_alert: int
    updated_at: datetime


class DeletedAlertViewedResponseData(BaseModel):
    status: str
    request_offer_stats: RequestOfferStatsSchema


class DeletedAlertViewedResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: DeletedAlertViewedResponseData
    links: LinkSet = Field(alias="_links")
    

class RequestEditPayload(BaseModel):
    status: str | None = None
    deadline_at: datetime | None = None
    owner_user_id: str | None = None


class RequestFileMutationResponseData(BaseModel):
    request_id: int
    file_id: int


class RequestMutationResponseData(BaseModel):
    request_id: int


class RequestMutationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestMutationResponseData
    links: LinkSet = Field(alias="_links")


class RequestFileMutationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: RequestFileMutationResponseData
    links: LinkSet = Field(alias="_links")