from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class EmailMessagePayload:
    to_email: str
    subject: str
    text_content: str
    html_content: str | None = None