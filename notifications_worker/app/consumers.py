from __future__ import annotations

import json

from aio_pika.abc import AbstractIncomingMessage

from app.email_sender import send_email
from app.tg_sender import send_tg
from shared.broker import RK_EMAIL, RK_TG


async def handle_message(message: AbstractIncomingMessage) -> None:
    async with message.process(requeue=False):
        payload = json.loads(message.body.decode("utf-8"))
        if message.routing_key == RK_EMAIL:
            await send_email(payload)
            return
        if message.routing_key == RK_TG:
            await send_tg(payload)