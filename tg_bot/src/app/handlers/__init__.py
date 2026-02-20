from __future__ import annotations

from aiogram import Dispatcher

from app.handlers.start import router as start_router


def setup_dispatcher() -> Dispatcher:
    dispatcher = Dispatcher()
    dispatcher.include_router(start_router)
    return dispatcher