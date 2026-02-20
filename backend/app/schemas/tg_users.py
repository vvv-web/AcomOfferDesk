from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.links import LinkSet


class TgUserStartRequest(BaseModel):
    tg_id: int


class TgUserStartData(BaseModel):
    tg_id: int
    status: str


class TgUserStartResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: TgUserStartData
    links: LinkSet = Field(alias="_links")

class TgStartRequest(BaseModel):
    tg_id: int


class TgOpenRequestItem(BaseModel):
    request_id: int
    description: str | None
    deadline_at: datetime
    link: str


class TgStartData(BaseModel):
    tg_id: int
    tg_status: str
    action: str
    registration_link: str | None = None
    requests: list[TgOpenRequestItem] = Field(default_factory=list)
    user_status: str | None = None


class TgStartResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: TgStartData
    links: LinkSet = Field(alias="_links")