from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import bindparam, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm_models import EconomyPlan


@dataclass(frozen=True)
class PlanDistributionRow:
    plan_id: int
    allocated_to_children_amount: Decimal
    unallocated_amount: Decimal


class EconomyPlanRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        *,
        name: str,
        user_id: str,
        parent_plan_id: int | None,
        parent_user_id_snapshot: str | None,
        period_start: date,
        period_end: date,
        plan_amount: Decimal,
    ) -> EconomyPlan:
        plan = EconomyPlan(
            name=name,
            id_user=user_id,
            id_parent_plan=parent_plan_id,
            id_parent_user_snapshot=parent_user_id_snapshot,
            period_start=period_start,
            period_end=period_end,
            plan_amount=plan_amount,
        )
        self._session.add(plan)
        await self._session.flush()
        return plan

    async def get_by_id(self, *, plan_id: int) -> EconomyPlan | None:
        stmt = select(EconomyPlan).where(EconomyPlan.id == plan_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id_for_update(self, *, plan_id: int) -> EconomyPlan | None:
        stmt = select(EconomyPlan).where(EconomyPlan.id == plan_id).with_for_update()
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_root_by_user_in_month(
        self,
        *,
        user_id: str,
        month_start: date,
        month_end: date,
    ) -> EconomyPlan | None:
        stmt = (
            select(EconomyPlan)
            .where(
                EconomyPlan.id_parent_plan.is_(None),
                EconomyPlan.id_user == user_id,
                EconomyPlan.period_start >= month_start,
                EconomyPlan.period_start <= month_end,
            )
            .order_by(EconomyPlan.id.asc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def exists_identical_plan(
        self,
        *,
        user_id: str,
        parent_plan_id: int | None,
        name: str,
        period_start: date,
        period_end: date,
    ) -> bool:
        stmt = select(EconomyPlan.id).where(
            EconomyPlan.id_user == user_id,
            EconomyPlan.id_parent_plan == parent_plan_id,
            EconomyPlan.name == name,
            EconomyPlan.period_start == period_start,
            EconomyPlan.period_end == period_end,
        ).limit(1)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def list_by_month_bucket(
        self,
        *,
        month_start: date,
        month_end: date,
    ) -> list[EconomyPlan]:
        stmt = (
            select(EconomyPlan)
            .where(
                EconomyPlan.period_start >= month_start,
                EconomyPlan.period_start <= month_end,
            )
            .order_by(EconomyPlan.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_subtree(self, *, root_plan_id: int) -> list[EconomyPlan]:
        ids_stmt = text(
            """
            WITH RECURSIVE plan_tree AS (
              SELECT ep.id
              FROM economy_plans ep
              WHERE ep.id = :root_plan_id

              UNION ALL

              SELECT ch.id
              FROM economy_plans ch
              JOIN plan_tree pt
                ON ch.id_parent_plan = pt.id
            )
            SELECT id
            FROM plan_tree
            """
        )
        ids_result = await self._session.execute(ids_stmt, {"root_plan_id": root_plan_id})
        plan_ids = [int(plan_id) for plan_id in ids_result.scalars().all()]
        if not plan_ids:
            return []
        stmt = select(EconomyPlan).where(EconomyPlan.id.in_(plan_ids)).order_by(EconomyPlan.id.asc())
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_children(
        self,
        *,
        parent_plan_id: int,
    ) -> list[EconomyPlan]:
        stmt = (
            select(EconomyPlan)
            .where(EconomyPlan.id_parent_plan == parent_plan_id)
            .order_by(EconomyPlan.id.asc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def sum_children_plan_amount(
        self,
        *,
        parent_plan_id: int,
        exclude_plan_id: int | None = None,
    ) -> Decimal:
        stmt = select(func.coalesce(func.sum(EconomyPlan.plan_amount), 0)).where(EconomyPlan.id_parent_plan == parent_plan_id)
        if exclude_plan_id is not None:
            stmt = stmt.where(EconomyPlan.id != exclude_plan_id)
        result = await self._session.execute(stmt)
        value = result.scalar_one()
        return Decimal(str(value))

    async def fetch_distribution_by_plan_ids(self, *, plan_ids: list[int]) -> dict[int, PlanDistributionRow]:
        if not plan_ids:
            return {}
        stmt = (
            text(
                """
                SELECT
                  plan_id,
                  allocated_to_children_amount,
                  unallocated_amount
                FROM v_economy_plan_distribution
                WHERE plan_id IN :plan_ids
                """
            )
            .bindparams(bindparam("plan_ids", expanding=True))
        )
        result = await self._session.execute(stmt, {"plan_ids": plan_ids})
        return {
            int(plan_id): PlanDistributionRow(
                plan_id=int(plan_id),
                allocated_to_children_amount=Decimal(str(allocated_to_children_amount or 0)),
                unallocated_amount=Decimal(str(unallocated_amount or 0)),
            )
            for plan_id, allocated_to_children_amount, unallocated_amount in result.all()
        }

    async def aggregate_active_request_facts_by_plan_ids(self, *, plan_ids: list[int]) -> dict[int, Decimal]:
        if not plan_ids:
            return {}
        stmt = (
            text(
                """
                SELECT
                  eprf.id_plan,
                  COALESCE(SUM(eprf.fact_amount), 0) AS fact_amount
                FROM economy_plan_request_facts eprf
                WHERE eprf.is_active = TRUE
                  AND eprf.id_plan IN :plan_ids
                GROUP BY eprf.id_plan
                """
            )
            .bindparams(bindparam("plan_ids", expanding=True))
        )
        result = await self._session.execute(stmt, {"plan_ids": plan_ids})
        return {
            int(plan_id): Decimal(str(fact_amount or 0))
            for plan_id, fact_amount in result.all()
        }

    async def update(
        self,
        *,
        plan: EconomyPlan,
        name: str | None = None,
        plan_amount: Decimal | None = None,
        period_start: date | None = None,
        period_end: date | None = None,
    ) -> None:
        if name is not None:
            plan.name = name
        if plan_amount is not None:
            plan.plan_amount = plan_amount
        if period_start is not None:
            plan.period_start = period_start
        if period_end is not None:
            plan.period_end = period_end
        plan.updated_at = datetime.utcnow()

    async def close_subtree(self, *, root_plan_id: int, closed_at: date) -> None:
        stmt = text(
            """
            WITH RECURSIVE plan_tree AS (
              SELECT ep.id
              FROM economy_plans ep
              WHERE ep.id = :root_plan_id

              UNION ALL

              SELECT ch.id
              FROM economy_plans ch
              JOIN plan_tree pt
                ON ch.id_parent_plan = pt.id
            )
            UPDATE economy_plans ep
            SET period_end = :closed_at,
                updated_at = now()
            FROM plan_tree pt
            WHERE ep.id = pt.id
            """
        )
        await self._session.execute(stmt, {"root_plan_id": root_plan_id, "closed_at": closed_at})

    async def delete(self, *, plan: EconomyPlan) -> None:
        await self._session.delete(plan)
