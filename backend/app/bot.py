# backend/app/bot.py

import logging
import os
import json
import re

import telebot
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup

# ------------------------
# ENV
# ------------------------
BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")          # https://tma-cafe-backend.onrender.com
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH")        # /bot
APP_URL = os.getenv("APP_URL")                  # https://luvcore.shop
OWNER_CHAT_ID = int(os.getenv("OWNER_CHAT_ID", "62330887"))

bot = TeleBot(BOT_TOKEN, parse_mode=None)


# -----------------------------------------
# DEBUG LOGGING
# -----------------------------------------
def enable_debug_logging():
    telebot.logger.setLevel(logging.DEBUG)


# -----------------------------------------
# WebApp → Checkout JSON
# -----------------------------------------
@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message):
    raw = message.web_app_data.data
    logging.info(f"[BOT] got web_app_data: {raw}")

    try:
        order = json.loads(raw)
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка разбора JSON: {e}")
        return

    if not isinstance(order, list):
        bot.send_message(message.chat.id, f"Неожиданный формат заказа: {order}")
        return

    # ---- Формируем текст заказа ----
    text = ""
    total = 0

    for item in order:
        caf = item.get("cafeteria") or {}
        var = item.get("variant") or {}
        qty = int(item.get("quantity", 1))
        price = int(item.get("cost", 0))

        name = caf.get("name", "Товар")
        variant = var.get("name", "")
        total += price * qty

        text += f"{name} {variant} × {qty} = {price * qty} ₽\n"

    summary = f"Ваш заказ:\n\n{text}\nИтого: {total} ₽"

    # ---- создаём invoice link ----
    invoice = bot.create_invoice_link(
        title="Оплата заказа",
        description="Покупка в Laurel Cafe",
        payload="order_payload",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True
    )

    # ---- отправляем клиенту ----
    bot.send_message(message.chat.id, summary)
    bot.send_message(message.chat.id, "Перейдите к оплате:")
    bot.send_message(
        message.chat.id,
        f"<a href='{invoice}'>Оплатить заказ</a>",
        parse_mode="HTML"
    )

    # ---- уведомление владельцу ----
    bot.send_message(
        OWNER_CHAT_ID,
        f"🆕 Новый заказ от @{message.from_user.username or 'клиента'}\n\n{summary}"
    )


# -----------------------------------------
# Successful payment
# -----------------------------------------
@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message):
    amount = message.successful_payment.total_amount // 100

    bot.send_message(
        message.chat.id,
        f"❤️ Оплата {amount} ₽ прошла успешно!"
    )

    bot.send_message(
        OWNER_CHAT_ID,
        f"💰 Клиент @{message.from_user.username or 'user'} оплатил заказ — {amount} ₽"
    )


# -----------------------------------------
# Pre-checkout
# -----------------------------------------
@bot.pre_checkout_query_handler(func=lambda q: True)
def handle_pre_checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# -----------------------------------------
# /start
# -----------------------------------------
@bot.message_handler(commands=["start"])
def handle_start(message: Message):
    markup = quick_markup(
        {
            "Open menu": {"web_app": WebAppInfo(APP_URL)}
        },
        row_width=1,
    )
    bot.send_message(message.chat.id,
                     "Welcome to Laurel Cafe! 🥐\nНажмите ниже, чтобы открыть меню.",
                     reply_markup=markup)


# -----------------------------------------
# fallback
# -----------------------------------------
@bot.message_handler()
def handle_all(message: Message):
    markup = quick_markup(
        {"Open menu": {"web_app": WebAppInfo(APP_URL)}},
        row_width=1,
    )
    bot.send_message(message.chat.id,
                     "Чтобы оформить заказ, откройте меню:",
                     reply_markup=markup)


# -----------------------------------------
# Webhook handler (used by Flask)
# -----------------------------------------
def process_update(update_json: dict):
    update = Update.de_json(update_json)
    bot.process_new_updates([update])


# -----------------------------------------
# Refresh webhook
# -----------------------------------------
def refresh_webhook():
    bot.remove_webhook()
    bot.set_webhook(WEBHOOK_URL + WEBHOOK_PATH)
