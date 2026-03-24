from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user, get_uow
from app.core.uow import UnitOfWork
from app.domain.policies import CurrentUser
from app.schemas.dashboard import (
    DashboardEconomistNodeSchema,
    DashboardRequestItemSchema,
    DashboardStatusCounterSchema,
    UpcomingUnavailabilityItemSchema,
    ResponsibilityDashboardData,
    ResponsibilityDashboardResponse,
)
from app.schemas.links import Link, LinkSet
from app.services.dashboard import DashboardEconomistNode, DashboardService

router = APIRouter()


def _map_node(node: DashboardEconomistNode) -> DashboardEconomistNodeSchema:
    return DashboardEconomistNodeSchema(
        user_id=node.user_id,
        full_name=node.full_name,
        role_id=node.role_id,
        role_name=node.role_name,
        parent_user_id=node.parent_user_id,
        in_progress_total=node.in_progress_total,
        statuses=[
            DashboardStatusCounterSchema(
                status=status.status,
                status_label=status.status_label,
                count=status.count,
            )
            for status in node.statuses
        ],
        children=[_map_node(child) for child in node.children],
    )


def _map_request_item(item) -> DashboardRequestItemSchema:
    return DashboardRequestItemSchema(
        request_id=item.request_id,
        description=item.description,
        status=item.status,
        status_label=item.status_label,
        deadline_at=item.deadline_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
        owner_user_id=item.owner_user_id,
        owner_full_name=item.owner_full_name,
    )


@router.get("/dashboard/responsibility", response_model=ResponsibilityDashboardResponse)
async def get_responsibility_dashboard(
    current_user: CurrentUser = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
) -> ResponsibilityDashboardResponse:
    async with uow:
        service = DashboardService(uow.users, uow.requests, uow.user_status_periods)
        dashboard = await service.get_responsibility_dashboard(current_user=current_user)

    return ResponsibilityDashboardResponse(
        data=ResponsibilityDashboardData(
            tree=[_map_node(node) for node in dashboard.tree],
            unassigned_requests=[_map_request_item(item) for item in dashboard.unassigned_requests],
            my_requests=[_map_request_item(item) for item in dashboard.my_requests],
            assigned_requests=[_map_request_item(item) for item in dashboard.assigned_requests],
            active_unavailability=[
                UpcomingUnavailabilityItemSchema(
                    user_id=item.user_id,
                    full_name=item.full_name,
                    role_name=item.role_name,
                    status=item.status,
                    started_at=item.started_at,
                    ended_at=item.ended_at,
                )
                for item in dashboard.active_unavailability
            ],
            upcoming_unavailability=[
                UpcomingUnavailabilityItemSchema(
                    user_id=item.user_id,
                    full_name=item.full_name,
                    role_name=item.role_name,
                    status=item.status,
                    started_at=item.started_at,
                    ended_at=item.ended_at,
                )
                for item in dashboard.upcoming_unavailability
            ],
        ),
        _links=LinkSet(
            self=Link(href="/api/v1/dashboard/responsibility", method="GET"),
            available_actions=[
                Link(href="/api/v1/dashboard/responsibility", method="GET"),
                Link(href="/api/v1/requests/{request_id}", method="PATCH"),
                Link(href="/api/v1/requests", method="GET"),
            ],
        ),
    )
