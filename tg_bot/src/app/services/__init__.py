from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings


class BackendClientError(RuntimeError):
    pass


@dataclass(slots=True)
class BackendClient:
    base_url: str

    async def register_tg_user(self, tg_id: int) -> None:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/tg/users/start",
                    json={"tg_id": tg_id},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise BackendClientError("Backend request failed") from exc


def get_backend_client() -> BackendClient:
    return BackendClient(base_url=settings.backend_base_url.rstrip("/"))
