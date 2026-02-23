from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.links import LinkSet


class FeedBackCreateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=3000)


class FeedBackCreateData(BaseModel):
    feedback_id: int


class FeedBackCreateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: FeedBackCreateData
    links: LinkSet = Field(alias="_links")
