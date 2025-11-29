# backend/app/bot.py

import os
import re
import json
import logging

import telebot
from telebot import TeleBot
from telebot.types import Update, Message, WebAppInfo
from telebot.util import quick_markup


BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH")
APP_URL = os.getenv("APP_URL")
OWNER_CHAT_ID = 623300887

bot = TeleBot(BOT_TOKEN, parse_mode="HTML")


def enable_debug_logging():
    telebot.logger.setLevel(logging.DEBUG)


# ----------------------------------------------------------------
#                      /start
# ----------------------------------------------------------------

@bot.message_handler(commands=["start"])
def start_cmd(message: Message):
    send_actionable_message(
        chat_id=message.chat.id,
        text="Welcome to Laurel Cafe! 🌿\nНажми кнопку ниже, чтобы открыть меню."
    )


# ----------------------------------------------------------------
#                 Fallback хендлер
# ----------------------------------------------------------------

@bot.message_handler(content_types=["text"])
def fallback(message: Message):
    send_actionable_message(
        chat_id=message.chat.id,
        text="Чтобы оформить заказ — открой меню по кнопке ниже 🙂"
    )


# ----------------------------------------------------------------
#    Mini App checkout → web_app_data
# ----------------------------------------------------------------

@bot.message_handler(content_types=["web_app_data"])
def handle_web_app(message: Message):
    raw = message.web_app_data.data

    try:
        order = json.loads(raw)
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка разбора JSON: {e}")
        return

    if not isinstance(order, list):
        bot.send_message(message.chat.id, "Неверный формат заказа.")
        return

    items = ""
    total = 0

    for item in order:
        caf = item.get("cafeteria", {})
        var = item.get("variant", {})
        qty = int(item.get("quantity", 1))
        cost = int(item.get("cost", 0))

        name = caf.get("name", "Товар")
        vname = var.get("name", "")
        total += cost * qty

        items += f"{name} ({vname}) × {qty} = {cost * qty} ₽\n"

    summary = f"Ваш заказ:\n{items}\nИтого: {total} ₽"

    invoice = bot.create_invoice_link(
        title="Оплата заказа",
        description="Оплата заказа в Laurel Cafe",
        payload="order",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True,
    )

    bot.send_message(message.chat.id, summary)
    bot.send_message(message.chat.id, f'<a href="{invoice}">Оплатить заказ</a>', parse_mode="HTML")

    # уведомляем владельца
    bot.send_message(OWNER_CHAT_ID, f"Новый заказ:\n{summary}")


# ----------------------------------------------------------------
#           Successful payment
# ----------------------------------------------------------------

@bot.message_handler(content_types=["successful_payment"])
def payment_success(message: Message):
    amount = message.successful_payment.total_amount // 100

    bot.send_message(message.chat.id, f"Оплата {amount} ₽ прошла успешно! ❤️")

    bot.send_message(
        OWNER_CHAT_ID,
        f"Клиент @{message.from_user.username or 'user'} успешно оплатил заказ на {amount} ₽"
    )


# ----------------------------------------------------------------
#                    Pre-checkout
# ----------------------------------------------------------------

@bot.pre_checkout_query_handler(func=lambda _: True)
def checkout(q):
    bot.answer_pre_checkout_query(q.id, ok=True)


# ----------------------------------------------------------------
#                WebApp кнопка (Mini App)
# ----------------------------------------------------------------

def send_actionable_message(chat_id: int, text: str):
    markup = quick_markup({
        "Open menu": {
            "web_app": WebAppInfo(APP_URL)
        }
    }, row_width=1)

    bot.send_message(chat_id, text, reply_markup=markup)


# ----------------------------------------------------------------
#             Webhook control (from Flask)
# ----------------------------------------------------------------

def refresh_webhook():
    bot.remove_webhook()
    bot.set_webhook(WEBHOOK_URL + "/" + WEBHOOK_PATH)


def process_update(update_json):
    upd = Update.de_json(update_json)
    bot.process_new_updates([upd])
