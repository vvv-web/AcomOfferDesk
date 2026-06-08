from __future__ import annotations
from shared.amqp_connect import connect_robust_amqp

import json

import aio_pika

from app.core.config import settings
from shared.broker import EXCHANGE


async def publish_notification(event_type: str, payload: dict) -> None:
    connection = await connect_robust_amqp(settings.rabbitmq_url)
    try:
        channel = await connection.channel()
        exchange = await channel.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
        message = aio_pika.Message(
            body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await exchange.publish(message, routing_key=event_type)
    finally:
        await connection.close()