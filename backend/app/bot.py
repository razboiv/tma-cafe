import os
import logging

import telebot
from telebot.types import (
    Update,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
APP_URL = os.getenv("APP_URL")  # напр. https://luvcore.shop
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not set")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")


# ---------- Хэндлеры ----------

@bot.message_handler(commands=["start"])
def handle_start(message):
    kb = InlineKeyboardMarkup()
    kb.add(
        InlineKeyboardButton(
            text="Открыть меню",
            web_app=WebAppInfo(APP_URL),
        )
    )
    bot.send_message(
        message.chat.id,
        "Привет! Нажми кнопку ниже, чтобы открыть меню кафе.",
        reply_markup=kb,
    )


@bot.pre_checkout_query_handler(func=lambda q: True)
def handle_pre_checkout(pre_checkout_query):
    # просто говорим Telegram, что всё ок
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message):
    bot.send_message(
        message.chat.id,
        "✅ Оплата прошла успешно! Спасибо за заказ 🙌",
    )


# ---------- Сервисные функции для webhooks ----------

def process_update(json_data: str) -> None:
    """Вызывается из Flask при POST /bot"""
    try:
        update = Update.de_json(json_data)
        if update:
            bot.process_new_updates([update])
    except Exception as e:
        logger.exception("Failed to process update: %s", e)


def refresh_webhook() -> dict:
    """Сброс и установка webhook. Вызывается из Flask /refresh_webhook"""
    from telebot.apihelper import ApiTelegramException

    webhook_url = os.getenv("WEBHOOK_URL")  # без /bot в конце
    webhook_path = os.getenv("WEBHOOK_PATH", "bot")

    if not webhook_url:
        raise RuntimeError("WEBHOOK_URL is not set")

    full_url = f"{webhook_url.rstrip('/')}/{webhook_path.lstrip('/')}"
    logger.info("Setting webhook to %s", full_url)

    try:
        bot.remove_webhook()  # без drop_pending_updates, чтобы не было ошибки
        bot.set_webhook(
            url=full_url,
            allowed_updates=["message", "pre_checkout_query", "successful_payment"],
        )
        return {"status": "ok", "url": full_url}
    except ApiTelegramException as e:
        logger.exception("Failed to set webhook: %s", e)
        return {"status": "error", "description": str(e)}
