from pydantic import BaseModel, ConfigDict, Field


class Link(BaseModel):
    href: str
    method: str


class LinkSet(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    self: Link
    available_actions: list[Link] | None = Field(default=None, alias="availableActions")