import os
import json
import logging
import re

import telebot
from telebot import TeleBot
from telebot.apihelper import ApiTelegramException
from telebot.types import (
    Update,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    LabeledPrice,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === ENV ===
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
APP_URL = os.getenv("APP_URL", "")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "").rstrip("/")
WEBHOOK_PATH = "/" + os.getenv("WEBHOOK_PATH", "bot").strip("/")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")

# === Bot ===
bot: TeleBot = TeleBot(BOT_TOKEN, parse_mode=None)


# ---------- Хэндлеры сообщений ----------

@bot.message_handler(func=lambda m: re.match(r"^/?start", (m.text or ""), re.I))
def handle_start(message):
    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("Explore Menu", web_app=WebAppInfo(APP_URL)))
    bot.send_message(
        message.chat.id,
        "Привет! Нажми кнопку ниже, чтобы открыть меню кафе.",
        reply_markup=kb,
    )

@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message):
    """Приходит после Checkout из Mini App (Telegram.WebApp.sendData)."""
    try:
        data = json.loads(message.web_app_data.data or "{}")
        items = data.get("cartItems") or []
        if not items:
            bot.send_message(message.chat.id, "Корзина пустая 🤷‍♂️")
            return

        # Готовим позиции для инвойса
        prices = []
        total = 0
        for it in items:
            name = it["cafeItem"]["name"]
            variant = it["variant"]["name"]
            cost = int(it["variant"]["cost"])
            qty = int(it["quantity"])
            amount = cost * qty
            total += amount
            prices.append(LabeledPrice(label=f"{name} ({variant}) x{qty}", amount=amount))

        # Отправляем инвойс в чат
        bot.send_invoice(
            chat_id=message.chat.id,
            title="Laurel Cafe — Order",
            description="Оплата заказа",
            payload="orderID",
            provider_token=PAYMENT_PROVIDER_TOKEN,
            currency="USD",
            prices=prices,
            need_name=True,
            need_phone_number=True,
            need_shipping_address=True,
            start_parameter="tma-cafe",
        )
    except Exception as e:
        logger.exception("Failed to handle web_app_data: %s", e)
        bot.send_message(message.chat.id, "Не удалось создать счёт 😕")

@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message):
    bot.send_message(message.chat.id, "✅ Оплата прошла успешно! Спасибо за заказ 🙌")


# ---------- Сервис для webhooks ----------

def process_update(update_json):
    try:
        upd = Update.de_json(update_json)
        if upd:
            bot.process_new_updates([upd])
    except Exception:
        logger.exception("Failed to process update")

def refresh_webhook():
    """Ставит вебхук и возвращает краткую информацию для /refresh-webhook."""
    full_url = f"{WEBHOOK_URL}{WEBHOOK_PATH}"
    try:
        bot.remove_webhook()
        ok = bot.set_webhook(
            url=full_url,
            allowed_updates=["message", "web_app_data", "pre_checkout_query", "successful_payment"],
        )
        logger.info("Webhook set to %s (ok=%s)", full_url, ok)
        # get_webhook_info может отсутствовать в старых версиях pyTelegramBotAPI — поэтому без строгой зависимости
        info = {"url": full_url}
    except ApiTelegramException as e:
        logger.exception("Failed to set webhook: %s", e)
        info = {"error": str(e)}
    return info
