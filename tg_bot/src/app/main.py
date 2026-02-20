from __future__ import annotations

import asyncio
import logging

from aiogram import Bot
from aiogram.types import BotCommand

from app.handlers import setup_dispatcher
from app.core.config import settings


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    bot = Bot(token=settings.bot_token)
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Регистрация или просмотр открытых заявок"),
            BotCommand(command="info", description="Информация о сервисе и процессе работы"),
        ]
    )
    dispatcher = setup_dispatcher()
    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())