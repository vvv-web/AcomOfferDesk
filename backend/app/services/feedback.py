from __future__ import annotations

from dataclasses import dataclass

from app.domain.policies import CurrentUser
from app.repositories.feedback import FeedBackRepository


@dataclass(frozen=True)
class FeedBackCreateResult:
    feedback_id: int


class FeedBackService:
    def __init__(self, feedback: FeedBackRepository):
        self._feedback = feedback

    async def create_feedback(self, *, current_user: CurrentUser, text: str) -> FeedBackCreateResult:
        _ = current_user
        item = await self._feedback.create(text=text)
        return FeedBackCreateResult(feedback_id=item.id)
