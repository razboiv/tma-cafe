import os
import json
import logging
import re
import telebot
from telebot import TeleBot
from telebot.types import (
    Update, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, LabeledPrice
)
from telebot.apihelper import ApiTelegramException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === ENV ===
BOT_TOKEN   = os.getenv("BOT_TOKEN", "")
APP_URL     = os.getenv("APP_URL", "")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "").rstrip("/")
WEBHOOK_PATH = "/" + os.getenv("WEBHOOK_PATH", "bot").strip("/")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")

# === bot ===
bot: TeleBot = TeleBot(BOT_TOKEN, parse_mode=None)

# ------------- handlers -------------
@bot.message_handler(func=lambda m: re.match(r"^/?start", (m.text or ""), re.I))
def handle_start(message):
    kb = InlineKeyboardMarkup()
    kb.add(InlineKeyboardButton("Explore Menu", web_app=WebAppInfo(APP_URL)))
    bot.send_message(
        message.chat.id,
        "Welcome to Laurel Cafe! Tap the button to open the menu.",
        reply_markup=kb,
    )

# оставляем и вариант через sendData — вдруг запустят из кнопки в чате
@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message):
    try:
        data = json.loads(message.web_app_data.data or "{}")
        items = data.get("cartItems") or []
        if not items:
            bot.send_message(message.chat.id, "Корзина пустая 🤷‍♂️")
            return

        prices = []
        for it in items:
            name = it["cafeItem"]["name"]
            variant = it["variant"]["name"]
            cost = int(it["variant"]["cost"])
            qty  = int(it["quantity"])
            prices.append(LabeledPrice(f"{name} ({variant}) x{qty}", cost * qty))

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
    except Exception:
        logger.exception("web_app_data error")
        bot.send_message(message.chat.id, "Не удалось создать счёт 😕")

@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message):
    bot.send_message(message.chat.id, "✅ Оплата прошла успешно! Спасибо 🙌")

# ------------- webhook utils -------------
def process_update(update_raw):
    try:
        if isinstance(update_raw, (bytes, bytearray)):
            update_raw = update_raw.decode("utf-8")
        data = json.loads(update_raw) if isinstance(update_raw, str) else update_raw
        upd = Update.de_json(data)
        if upd:
            bot.process_new_updates([upd])
    except Exception:
        logger.exception("Failed to process update")

def refresh_webhook():
    full = f"{WEBHOOK_URL}{WEBHOOK_PATH}"
    try:
        bot.remove_webhook()
        ok = bot.set_webhook(
            url=full,
            allowed_updates=["message", "pre_checkout_query"],  # достаточно
        )
        logger.info("Webhook set to %s (ok=%s)", full, ok)
        return {"url": full, "ok": ok}
    except ApiTelegramException as e:
        logger.exception("Failed to set webhook: %s", e)
        return {"error": str(e), "url": full}

def create_invoice_link(prices):
    return bot.create_invoice_link(
        title="Order #1",
        description="Great choice! Last steps and we will get to cooking ;)",
        payload="orderID",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="USD",
        prices=prices,
        need_name=True,
        need_phone_number=True,
        need_shipping_address=True,
    )
