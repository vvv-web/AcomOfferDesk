from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.links import LinkSet


class DashboardStatusCounterSchema(BaseModel):
    status: str
    status_label: str
    count: int


class DashboardEconomistNodeSchema(BaseModel):
    user_id: str
    full_name: str | None
    role_id: int
    role_name: str
    parent_user_id: str | None
    in_progress_total: int
    statuses: list[DashboardStatusCounterSchema]
    children: list["DashboardEconomistNodeSchema"] = Field(default_factory=list)


class DashboardRequestItemSchema(BaseModel):
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    created_at: datetime
    updated_at: datetime
    owner_user_id: str
    owner_full_name: str | None


class UpcomingUnavailabilityItemSchema(BaseModel):
    user_id: str
    full_name: str | None
    role_name: str
    status: str
    started_at: datetime
    ended_at: datetime


class ResponsibilityDashboardData(BaseModel):
    tree: list[DashboardEconomistNodeSchema]
    unassigned_requests: list[DashboardRequestItemSchema]
    assigned_requests: list[DashboardRequestItemSchema]
    active_unavailability: list[UpcomingUnavailabilityItemSchema]
    upcoming_unavailability: list[UpcomingUnavailabilityItemSchema]


class ResponsibilityDashboardResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: ResponsibilityDashboardData
    links: LinkSet = Field(alias="_links")
