import logging
import os
import re
import telebot
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup

# -------- ENV --------
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")

# URL бэкенда, где висит вебхук (Render)
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "").rstrip("/")
# Путь вебхука — нормализуем к виду "/bot"
WEBHOOK_PATH = "/" + os.getenv("WEBHOOK_PATH", "bot").strip("/")

# URL фронтенда (Vercel/домен), откроется при нажатии кнопки в боте
APP_URL = os.getenv("APP_URL", "")

# -------- Bot --------
bot = TeleBot(BOT_TOKEN, parse_mode=None)


# ---------- Handlers ----------

@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message):
    """Сообщение об успешной оплате."""
    user_name = (message.successful_payment.order_info.name
                 if message.successful_payment and message.successful_payment.order_info
                 else "friend")
    text = (
        f"Thank you for your order, *{user_name}*!\n\n"
        "This is a demo cafe, so your card was not charged.\n"
        "Have a nice day 🙂"
    )
    bot.send_message(chat_id=message.chat.id, text=text, parse_mode="markdown")


@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query):
    """Всегда подтверждаем, что всё в наличии (демо)."""
    bot.answer_pre_checkout_query(pre_checkout_query_id=pre_checkout_query.id, ok=True)


@bot.message_handler(func=lambda m: re.match(r"^/?start", m.text or "", re.I) is not None)
def handle_start_command(message: Message):
    """Обработка /start — отправляем кнопку для открытия Mini App."""
    send_actionable_message(
        chat_id=message.chat.id,
        text="*Welcome to Laurel Cafe!* 🌿\n\n"
             "It is time to order something delicious 😋 Tap the button below to get started."
    )


@bot.message_handler()
def handle_all_messages(message: Message):
    """Фолбэк для всех остальных сообщений."""
    send_actionable_message(
        chat_id=message.chat.id,
        text="To be honest, I don't know how to reply to this message… "
             "Please open our menu — I am sure you will find something to your liking! 😉"
    )


def send_actionable_message(chat_id: int, text: str):
    """Текст + инлайн-кнопка, которая открывает Mini App по APP_URL."""
    markup = quick_markup(
        {"Explore Menu": {"web_app": WebAppInfo(APP_URL)}},
        row_width=1
    )
    bot.send_message(chat_id=chat_id, text=text, parse_mode="markdown", reply_markup=markup)


# ---------- Сервисные функции ----------

def refresh_webhook():
    """Снимаем старый вебхук и ставим новый."""
    try:
        bot.remove_webhook()
    finally:
        full_url = f"{WEBHOOK_URL}{WEBHOOK_PATH}"
        bot.set_webhook(full_url)


def process_update(update_json):
    """Пробрасываем апдейт (из Flask) в TeleBot."""
    update = Update.de_json(update_json)
    if update:
        bot.process_new_updates([update])


def create_invoice_link(prices) -> str:
    """Создаёт ссылку на оплату (инвойс) — обёртка над bot.create_invoice_link."""
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


def enable_debug_logging():
    """Включить подробные логи бота (можно дернуть из main.py при DEV_MODE)."""
    telebot.logger.setLevel(logging.DEBUG)
