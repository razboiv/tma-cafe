import os
import telebot
from telebot.types import Update, PreCheckoutQuery, Message

BOT_TOKEN = os.environ["BOT_TOKEN"]
PAYMENT_PROVIDER_TOKEN = os.environ["PAYMENT_PROVIDER_TOKEN"]

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")


# ---------- handlers ----------

@bot.message_handler(commands=["start"])
def cmd_start(message: Message):
    bot.send_message(
        message.chat.id,
        "Привет! /start работает, бот жив 🙂"
    )


@bot.pre_checkout_query_handler(func=lambda q: True)
def handle_pre_checkout(pre_checkout_query: PreCheckoutQuery):
    # если надо — можешь добавить свои проверки заказа
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message):
    bot.send_message(
        message.chat.id,
        "Оплата прошла успешно, спасибо ❤️"
    )


# ---------- helpers для Flask ----------

def process_update(json_update: dict) -> None:
    """Вызывается из Flask, когда приходит POST /bot."""
    update = Update.de_json(json_update)
    bot.process_new_updates([update])


def drop_pending_updates() -> None:
    """Очистить старые апдейты перед установкой вебхука."""
    try:
        bot.get_updates(offset=-1)
    except Exception:
        pass
