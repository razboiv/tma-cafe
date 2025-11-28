import logging
import os
import re
import json

import telebot
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup

BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH")
APP_URL = os.getenv("APP_URL")
OWNER_CHAT_ID = 623300887  # твой id, как было

bot = TeleBot(BOT_TOKEN, parse_mode=None)


# ------------ логирование ------------

def enable_debug_logging():
    """Включаем подробные логи TeleBot."""
    logging.basicConfig(level=logging.DEBUG)
    telebot.logger.setLevel(logging.DEBUG)


enable_debug_logging()


# ------------ /start ------------

@bot.message_handler(commands=["start"])
def handle_start_command(message: Message):
    logging.info("[BOT] handle_start_command: %s", message)

    send_actionable_message(
        chat_id=message.chat.id,
        text="Welcome to Laurel Cafe! 🌿\n\nIt is time to order something delicious 😋 Tap the button below to get started."
    )


# ------------ web_app_data из MiniApp (sendData) ------------

@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message):
    """
    Сюда прилетает payload из MiniApp после TelegramSDK.sendData(JSON.stringify(order)).
    """
    try:
        raw = message.web_app_data.data
    except Exception:
        bot.send_message(message.chat.id, "Пришло web_app_data, но без data :(")
        return

    logging.info("[BOT] handle_web_app_data raw: %s", raw)

    # Пытаемся распарсить JSON
    try:
        order = json.loads(raw)
    except Exception as e:
        logging.exception("Failed to parse web_app_data JSON")
        bot.send_message(
            chat_id=message.chat.id,
            text=f"Пришёл заказ из MiniApp, но не получилось распарсить JSON:\n`{raw}`\n\nОшибка: `{e}`",
            parse_mode="Markdown"
        )
        return

    # Собираем текст заказа
    items_text = ""
    total = 0

    for it in order:
        caf = it.get("cafeteria") or {}
        var = it.get("variant") or {}
        qty = int(it.get("quantity", 1))

        caf_name = caf.get("name") or caf.get("id") or "товар"
        var_name = var.get("name") or var.get("id") or "вариант"
        price = int(var.get("cost") or 0)

        pos_total = price * qty
        total += pos_total

        items_text += f"{caf_name} — {var_name} × {qty} = {price} ₽\n"

    summary = f"Ваш заказ из MiniApp:\n\n{items_text}\nИтого: {total} ₽"

    # Сообщение клиенту (подтверждение, что заказ дошёл)
    bot.send_message(
        chat_id=message.chat.id,
        text="Супер! Я получил твой заказ 👌 Сейчас открою окно оплаты."
    )

    # Сообщение владельцу
    bot.send_message(
        chat_id=OWNER_CHAT_ID,
        text=f"Новый заказ от @{message.from_user.username or 'клиента'}\n\n{summary}"
    )

    # Создаём invoice link через Telegram Payments
    prices = [telebot.types.LabeledPrice(label="Заказ", amount=total * 100)]
    invoice_link = create_invoice_link(prices)

    # Даём клиенту ссылку / открываем оплату (он тапает по ссылке)
    bot.send_message(
        chat_id=message.chat.id,
        text=f"Чтобы оплатить заказ, перейди по ссылке:\n{invoice_link}"
    )


# ------------ успешная оплата ------------

@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message):
    """
    Срабатывает автоматически после успешной оплаты invoice’а.
    """
    logging.info("[BOT] handle_successful_payment: %s", message)

    amount = message.successful_payment.total_amount // 100

    # Клиенту
    bot.send_message(
        chat_id=message.chat.id,
        text=f"💸 Оплата {amount} ₽ прошла успешно!\nСпасибо за покупку ❤️"
    )

    # Владельцу
    bot.send_message(
        chat_id=OWNER_CHAT_ID,
        text=f"✅ Клиент @{message.from_user.username or 'user'} успешно оплатил заказ на {amount} ₽"
    )


# ------------ pre_checkout (обязателен для Telegram Payments) ------------

@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query):
    """
    Тут можно дополнительно проверить заказ (наличие товара и т.п.).
    В примере просто всегда подтверждаем.
    """
    logging.info("[BOT] pre_checkout_query: %s", pre_checkout_query)
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# ------------ fallback для остальных сообщений ------------

@bot.message_handler(func=lambda message: True)
def handle_all_messages(message: Message):
    logging.info("[BOT] fallback message: %s", message)
    send_actionable_message(
        chat_id=message.chat.id,
        text="To be honest, I don't know how to reply to messages. "
             "But I can offer you to familiarize yourself with our menu. "
             "Tap the button below 👇"
    )


# ------------ вспомогательные функции ------------

def send_actionable_message(chat_id: int, text: str):
    """
    Отправляет текст + кнопку 'Open Shop', которая открывает MiniApp.
    """
    markup = quick_markup(
        {
            "Open Shop": {
                "web_app": WebAppInfo(APP_URL),
            }
        },
        row_width=1,
    )

    bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=markup,
        parse_mode="Markdown"
    )


def refresh_webhook():
    """
    Обновить webhook (мы дергаем это из main.py / вручную один раз).
    """
    bot.remove_webhook()
    bot.set_webhook(
        WEBHOOK_URL + WEBHOOK_PATH,
        allowed_updates=["message", "web_app_data", "pre_checkout_query", "successful_payment"]
    )


def process_update(update_json: dict):
    """
    Вызывается из Flask (main.py), когда приходит POST /bot.
    """
    update = Update.de_json(update_json)
    bot.process_new_updates([update])


def create_invoice_link(prices) -> str:
    """
    Создаёт invoice link для Telegram Payments.
    """
    return bot.create_invoice_link(
        title="Оплата заказа",
        description="Оплата покупки в Laurel Cafe",
        payload="order_payload",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=prices,
        need_name=True,
        need_phone_number=True,
        need_shipping_address=False,
    )
