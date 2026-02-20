from pydantic import BaseModel, ConfigDict, Field

from app.schemas.links import LinkSet


class TgLinkRequest(BaseModel):
    tg_id: int = Field(..., ge=1)


class TgLinkData(BaseModel):
    url: str


class TgLinkResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: TgLinkData
    links: LinkSet = Field(alias="_links")

