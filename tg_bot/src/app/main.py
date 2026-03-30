from __future__ import annotations

import asyncio
import logging

from aiogram import Bot
from aiogram.exceptions import TelegramNetworkError
from aiogram.types import BotCommand

from app.core.config import settings
from app.handlers import setup_dispatcher


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    bot = Bot(token=settings.bot_token)

    try:
        try:
            await bot.set_my_commands(
                [
                    BotCommand(command="start", description="Registration or open requests"),
                    BotCommand(command="info", description="Service and workflow information"),
                ]
            )
        except TelegramNetworkError:
            logger.warning(
                "Telegram API is temporarily unavailable during startup. Skip set_my_commands",
                exc_info=True,
            )

        dispatcher = setup_dispatcher()
        await dispatcher.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
