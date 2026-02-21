from __future__ import annotations

import asyncio
import json
import os
import urllib.parse
import urllib.request
from collections.abc import Iterable
from datetime import datetime

from app.core.config import settings
from app.core.tg_shortcodes import TgShortcodeCodec

async def notify_expired_link(tg_id: int) -> None:
    await _notify(
        tg_id=tg_id,
        text="Срок действия ссылки истек. Пожалуйста, запросите новую через /start.",
    )


async def notify_registration_completed(tg_id: int) -> None:
    await _notify(
        tg_id=tg_id,
        text="Регистрация пройдена. Данные отправлены на проверку.",
    )


async def notify_access_opened(tg_id: int) -> None:
    await _notify(
        tg_id=tg_id,
        text="Доступ открыт. Теперь вы можете войти в веб-приложение.",
    )

async def notify_access_closed(tg_id: int) -> None:
    await _notify(
        tg_id=tg_id,
        text="⛔ Доступ к Telegram-боту закрыт.",
    )

async def notify_new_message(*, tg_id: int, request_id: int) -> None:
    link =  _build_web_service_link(tg_id=tg_id)
    await _notify(
        tg_id=tg_id,
        text=f"💬 Новое сообщение по заявке №{request_id}",
        button_text="Открыть сервис",
        button_url=link,
    )

async def notify_new_request(
    *,
    tg_ids: Iterable[int],
    request_id: int,
    description: str | None,
    deadline_at: datetime,
) -> None:
    description_text = description.strip() if description else "без описания"
    deadline_text = deadline_at.strftime("%d.%m.%Y, %H:%M")
    tasks = []
    for tg_id in tg_ids:
        link =  _build_web_service_link(tg_id=tg_id)
        text = (
            f"📄 Новая заявка №{request_id}\n\n"
            f"📝 Описание: {description_text}\n"
            f"⏰ Дедлайн приёма КП: {deadline_text}"
        )
        tasks.append(
            _notify(
                tg_id=tg_id,
                text=text,
                button_text="Перейти в сервис",
                button_url=link,
            )
        )

    if tasks:
        await asyncio.gather(*tasks)

async def notify_request_status_changed(*, tg_id: int) -> None:
    await _notify(
        tg_id=tg_id,
        text="Статус интересующей вас заявки изменён.",
        button_text="Перейти в сервис",
        button_url=_build_web_service_link(tg_id=tg_id),
    )


async def notify_offer_status_finalized(*, tg_id: int) -> None:
    await _notify(
        tg_id=tg_id,
        text="Статус вашего оффера обновлён.",
        button_text="Перейти в сервис",
        button_url=_build_web_service_link(tg_id=tg_id),
    )

def _build_authorization_link(*, tg_id: int) -> str:
    if not settings.tg_link_secret or not settings.public_backend_base_url:
        return "Ссылка временно недоступна"
    payload = TgShortcodeCodec.build(
        tg_id=tg_id,
        purpose="tg_auth",
        ttl_seconds=settings.tg_request_ttl_seconds,
    )
    code = TgShortcodeCodec.encode(payload, secret=settings.tg_link_secret)
    return f"{settings.public_backend_base_url.rstrip('/')}/api/v1/tg/auth?token={code}"


def _build_web_service_link(*, tg_id: int) -> str:
    auth_link = _build_authorization_link(tg_id=tg_id)
    if not settings.web_base_url:
        return auth_link

    if not settings.tg_link_secret:
        return auth_link

    payload = TgShortcodeCodec.build(
        tg_id=tg_id,
        purpose="tg_auth",
        ttl_seconds=settings.tg_request_ttl_seconds,
    )
    code = TgShortcodeCodec.encode(payload, secret=settings.tg_link_secret)
    return f"{settings.web_base_url.rstrip('/')}/auth/login?token={code}"

async def _notify(
    *,
    tg_id: int,
    text: str,
    button_text: str | None = None,
    button_url: str | None = None,
) -> None:
    token = os.getenv("BOT_TOKEN")
    if not token:
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload_data: dict[str, str | int] = {"chat_id": tg_id, "text": text}
    if button_text and button_url:
        payload_data["reply_markup"] = json.dumps(
            {"inline_keyboard": [[{"text": button_text, "url": button_url}]]},
            ensure_ascii=False,
        )

    payload = urllib.parse.urlencode(payload_data)
    request = urllib.request.Request(
        url=url,
        data=payload.encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        await asyncio.to_thread(_send_request, request)
    except Exception:
        return

def _send_request(request: urllib.request.Request) -> None:
    with urllib.request.urlopen(request, timeout=5):
        return None
