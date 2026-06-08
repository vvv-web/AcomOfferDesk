from __future__ import annotations

import os
import ssl
from typing import Any

import aio_pika


def amqp_ssl_context() -> ssl.SSLContext | None:
    ca = os.getenv("RABBITMQ_SSL_CAFILE", "").strip()
    cert = os.getenv("RABBITMQ_SSL_CERTFILE", "").strip()
    key = os.getenv("RABBITMQ_SSL_KEYFILE", "").strip()
    if not ca and not cert and not key:
        return None
    ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH, cafile=ca or None)
    if cert and key:
        ctx.load_cert_chain(certfile=cert, keyfile=key)
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED
    return ctx


async def connect_robust_amqp(url: str, **kwargs: Any) -> aio_pika.RobustConnection:
    ssl_context = amqp_ssl_context()
    if ssl_context is not None:
        kwargs.setdefault("ssl_context", ssl_context)
    return await aio_pika.connect_robust(url, **kwargs)
