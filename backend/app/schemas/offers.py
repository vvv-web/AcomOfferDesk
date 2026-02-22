from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.links import LinkSet
from app.schemas.requests import RequestFileSchema


class ContractorInfoSchema(BaseModel):
    user_id: str
    full_name: str | None
    phone: str | None
    mail: str | None
    company_name: str | None
    inn: str | None
    company_phone: str | None
    company_mail: str | None
    address: str | None
    note: str | None


class ContractorInfoResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: ContractorInfoSchema
    links: LinkSet = Field(alias="_links")


class OfferMessageSchema(BaseModel):
    id: int
    user_id: str
    user_full_name: str | None
    text: str
    status: str
    created_at: datetime
    updated_at: datetime
    attachments: list[RequestFileSchema] = Field(default_factory=list)


class ExistingOfferPreviewSchema(BaseModel):
    offer_id: int
    status: str
    status_label: str
    files: list[RequestFileSchema]


class ContractorRequestViewSchema(BaseModel):
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    owner_user_id: str
    files: list[RequestFileSchema]
    owner_full_name: str | None
    existing_offer: ExistingOfferPreviewSchema | None


class ContractorRequestViewResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: ContractorRequestViewSchema
    links: LinkSet = Field(alias="_links")


class OfferWorkspaceRequestSchema(BaseModel):
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    owner_user_id: str
    owner_full_name: str | None
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None
    files: list[RequestFileSchema]


class OfferWorkspaceOfferSchema(BaseModel):
    offer_id: int
    status: str
    status_label: str
    created_at: datetime
    updated_at: datetime
    files: list[RequestFileSchema]


class OfferWorkspaceOfferListItemSchema(BaseModel):
    offer_id: int
    status: str
    status_label: str
    created_at: datetime
    updated_at: datetime
    files: list[RequestFileSchema]
    links: LinkSet = Field(alias="_links")


class OfferWorkspaceSchema(BaseModel):
    request: OfferWorkspaceRequestSchema
    offer: OfferWorkspaceOfferSchema
    offers: list[OfferWorkspaceOfferListItemSchema]
    contractor: ContractorInfoSchema


class OfferWorkspaceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OfferWorkspaceSchema
    links: LinkSet = Field(alias="_links")


class OfferCreateResponseData(BaseModel):
    offer_id: int
    request_id: int


class OfferCreateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OfferCreateResponseData
    links: LinkSet = Field(alias="_links")


class OfferFileMutationResponseData(BaseModel):
    offer_id: int
    file_id: int


class OfferFileMutationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OfferFileMutationResponseData
    links: LinkSet = Field(alias="_links")


class OfferMessageListData(BaseModel):
    offer_id: int
    items: list[OfferMessageSchema]


class OfferMessageListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OfferMessageListData
    links: LinkSet = Field(alias="_links")


class OfferMessageCreatePayload(BaseModel):
    text: str


class OfferMessageCreateResponseData(BaseModel):
    offer_id: int
    message_id: int


class OfferMessageCreateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OfferMessageCreateResponseData
    links: LinkSet = Field(alias="_links")


class OfferMessageStatusUpdatePayload(BaseModel):
    message_ids: list[int] = Field(default_factory=list)


class OfferMessageStatusUpdateResponseData(BaseModel):
    offer_id: int
    updated_count: int


class OfferMessageStatusUpdateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OfferMessageStatusUpdateResponseData
    links: LinkSet = Field(alias="_links")


class OfferStatusUpdatePayload(BaseModel):
    status: str


class OfferStatusMutationResponseData(BaseModel):
    offer_id: int
    status: str


class OfferStatusMutationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: OfferStatusMutationResponseData
    links: LinkSet = Field(alias="_links")