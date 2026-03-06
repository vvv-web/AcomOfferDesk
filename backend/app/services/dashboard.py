from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.core.config import settings
from app.domain.policies import CurrentUser, UserPolicy
from app.repositories.requests import RequestRepository
from app.repositories.users import UserRepository
from app.services.requests import format_request_status


@dataclass(frozen=True)
class DashboardStatusCounter:
    status: str
    status_label: str
    count: int


@dataclass
class DashboardEconomistNode:
    user_id: str
    full_name: str | None
    role_id: int
    role_name: str
    parent_user_id: str | None
    in_progress_total: int
    statuses: list[DashboardStatusCounter]
    children: list["DashboardEconomistNode"] = field(default_factory=list)


@dataclass(frozen=True)
class DashboardUnassignedRequest:
    request_id: int
    description: str | None
    status: str
    status_label: str
    deadline_at: datetime
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class ResponsibilityDashboard:
    tree: list[DashboardEconomistNode]
    unassigned_requests: list[DashboardUnassignedRequest]


class DashboardService:
    def __init__(self, users: UserRepository, requests: RequestRepository):
        self._users = users
        self._requests = requests

    async def get_responsibility_dashboard(self, *, current_user: CurrentUser) -> ResponsibilityDashboard:
        UserPolicy.can_view_responsibility_dashboard(current_user)

        staff_rows = await self._users.list_staff_with_profiles_and_roles_for_dashboard(
            role_ids=[settings.lead_economist_role_id, settings.economist_role_id],
        )

        by_id = {user.id: (user, profile, role) for user, profile, role in staff_rows}

        descendant_ids: set[str] = set()
        for user_id in by_id:
            cursor = user_id
            seen: set[str] = set()
            while cursor and cursor not in seen:
                seen.add(cursor)
                if cursor == current_user.user_id:
                    descendant_ids.add(user_id)
                    break
                parent = by_id.get(cursor)
                cursor = parent[0].id_parent if parent else None

        request_counters = await self._requests.count_in_progress_requests_by_owner(
            owner_ids=list(descendant_ids),
        )

        counters_by_user: dict[str, dict[str, int]] = {}
        for owner_id, status, count in request_counters:
            owner_counters = counters_by_user.setdefault(owner_id, {})
            owner_counters[status] = count

        nodes: dict[str, DashboardEconomistNode] = {}
        for user_id in descendant_ids:
            user, profile, role = by_id[user_id]
            status_counts = counters_by_user.get(user.id, {})
            statuses = [
                DashboardStatusCounter(
                    status=status,
                    status_label=format_request_status(status),
                    count=count,
                )
                for status, count in sorted(status_counts.items())
            ]
            nodes[user.id] = DashboardEconomistNode(
                user_id=user.id,
                full_name=profile.full_name if profile else None,
                role_id=user.id_role,
                role_name=role.role,
                parent_user_id=user.id_parent,
                in_progress_total=sum(status_counts.values()),
                statuses=statuses,
            )

        tree: list[DashboardEconomistNode] = []
        for node in nodes.values():
            if node.parent_user_id in nodes:
                nodes[node.parent_user_id].children.append(node)
            else:
                tree.append(node)

        tree.sort(key=lambda item: (item.role_id, item.full_name or item.user_id))
        self._sort_children(tree)

        unassigned_rows = await self._requests.list_unassigned_requests(
            operator_role_id=settings.operator_role_id,
        )
        unassigned_requests = [
            DashboardUnassignedRequest(
                request_id=request.id,
                description=request.description,
                status=request.status,
                status_label=format_request_status(request.status),
                deadline_at=request.deadline_at,
                created_at=request.created_at,
                updated_at=request.updated_at,
            )
            for request in unassigned_rows
        ]

        return ResponsibilityDashboard(tree=tree, unassigned_requests=unassigned_requests)

    def _sort_children(self, nodes: list[DashboardEconomistNode]) -> None:
        for node in nodes:
            node.children.sort(key=lambda item: (item.role_id, item.full_name or item.user_id))
            self._sort_children(node.children)