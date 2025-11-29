import logging
import os
import json
import re

import telebot
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup

BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH")
APP_URL = os.getenv("APP_URL")
OWNER_CHAT_ID = 62330887

bot = TeleBot(BOT_TOKEN, parse_mode=None)


def enable_debug_logging() -> None:
    telebot.logger.setLevel(logging.DEBUG)


@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message) -> None:
    raw = message.web_app_data.data
    logging.info(f"[BOT] got web_app_data: {raw}")

    try:
        order = json.loads(raw)
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка разбора JSON: {e}")
        return

    if not isinstance(order, list):
        bot.send_message(message.chat.id, f"Неверный формат заказа: {order}")
        return

    items_text = ""
    total = 0
    for item in order:
        caf = item.get("cafeteria", {})
        var = item.get("variant", {})
        qty = int(item.get("quantity") or 1)
        price = int(item.get("cost") or 0)

        name = caf.get("name", "Товар")
        variant = var.get("name", "")
        total += price * qty

        items_text += f"{name} — {variant} × {qty} = {price * qty} ₽\n"

    summary = f"Ваш заказ:\n\n{items_text}\nИтого: {total} ₽"

    invoice_link = bot.create_invoice_link(
        title="Оплата заказа",
        description="Покупка в Laurel Cafe",
        payload="order_payload",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True,
    )

    bot.send_message(message.chat.id, summary)
    bot.send_message(
        message.chat.id,
        '<a href="{0}">Оплатить заказ</a>'.format(invoice_link),
        parse_mode="HTML",
    )

    bot.send_message(
        OWNER_CHAT_ID,
        f"Новый заказ от @{message.from_user.username or 'клиента'}\n\n{summary}",
    )


@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message) -> None:
    amount = message.successful_payment.total_amount // 100

    bot.send_message(message.chat.id, f"❤️ Оплата {amount} ₽ прошла успешно!")
    bot.send_message(
        OWNER_CHAT_ID,
        f"💰 Клиент @{message.from_user.username or 'user'} оплатил {amount} ₽",
    )


@bot.pre_checkout_query_handler(func=lambda q: True)
def handle_pre_checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


@bot.message_handler(func=lambda m: re.match(r"^/start", m.text or "", re.I))
def handle_start(message: Message) -> None:
    send_actionable_message(message.chat.id, "Welcome to Laurel Cafe!")


@bot.message_handler()
def handle_all(message: Message) -> None:
    send_actionable_message(message.chat.id, "Открой меню кнопкой ниже 👇")


def send_actionable_message(chat_id: int, text: str) -> None:
    markup = quick_markup(
        {"Open menu": {"web_app": WebAppInfo(APP_URL)}}, row_width=1
    )
    bot.send_message(chat_id, text, reply_markup=markup, parse_mode="Markdown")


def refresh_webhook() -> None:
    bot.remove_webhook()
    bot.set_webhook(WEBHOOK_URL + "/" + WEBHOOK_PATH)


def process_update(update_json: dict) -> None:
    update = Update.de_json(update_json)
    bot.process_new_updates([update])
