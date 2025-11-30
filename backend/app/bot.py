# backend/app/bot.py

import logging
import os
import json
import re

import telebot
from telebot import TeleBot
from telebot.types import (
    Update,
    WebAppInfo,
    Message,
)

# ------------ настройки из окружения ------------

BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")          # https://tma-cafe-backend.onrender.com
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "bot") # bot
APP_URL = os.getenv("APP_URL")                  # https://luvcore.shop
OWNER_CHAT_ID = 623300887                       # твой айди

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not set in environment")

bot: TeleBot = TeleBot(BOT_TOKEN, parse_mode=None)  # parse_mode задаём в send_message


# ===============================================
#              ЛОГИРОВАНИЕ
# ===============================================

def enable_debug_logging() -> None:
    """Включаем подробные логи TeleBot (видно в Render-логах)."""
    telebot.logger.setLevel(logging.DEBUG)
    logging.getLogger().setLevel(logging.DEBUG)


# ===============================================
#        Mini App -> sendData(order)
# ===============================================

@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message) -> None:
    """
    Сюда прилетает JSON с заказом из MiniApp
    (Checkout -> Telegram.WebApp.sendData()).
    """
    raw = message.web_app_data.data
    logging.debug("[BOT] got web_app_data: %s", raw)

    # --- пытаемся распарсить JSON ---
    try:
        order = json.loads(raw)
    except Exception as e:
        logging.exception("Failed to parse web_app_data JSON: %s", e)
        bot.send_message(
            chat_id=message.chat.id,
            text=f"Ошибка разбора заказа: {e}",
        )
        return

    if not isinstance(order, list):
        bot.send_message(
            chat_id=message.chat.id,
            text=f"Неожиданный формат заказа: {order!r}",
        )
        return

    # --- формируем текст и сумму ---
    items_text = ""
    total = 0

    for item in order:
        caf = item.get("cafeteria") or {}
        var = item.get("variant") or {}
        qty = int(item.get("quantity") or 1)
        price = int(item.get("cost") or 0)

        name = caf.get("name", "Товар")
        variant = var.get("name", "")
        total += price * qty

        items_text += f"{name} — {variant} × {qty} = {price * qty} ₽\n"

    summary = f"Ваш заказ:\n\n{items_text}\nИтого: {total} ₽"

    # --- создаём счёт (invoice link / pay button) ---
    if not PAYMENT_PROVIDER_TOKEN:
        bot.send_message(
            message.chat.id,
            "Платёжный токен не настроен у бота.",
        )
        return

    invoice_link = bot.create_invoice_link(
        title="Оплата заказа",
        description="Оплата покупки в Laurel Cafe",
        payload="order_payload",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True,
    )

    # --- отправляем ссылку клиенту ---
    bot.send_message(message.chat.id, summary)
    bot.send_message(
        message.chat.id,
        "Перейдите к оплате по ссылке ниже:",
    )
    bot.send_message(
        message.chat.id,
        f'<a href="{invoice_link}">Оплатить заказ</a>',
        parse_mode="HTML",
    )

    # --- уведомляем владельца ---
    bot.send_message(
        OWNER_CHAT_ID,
        f"Новый заказ от @{message.from_user.username or 'клиента'}:\n\n{summary}",
    )


# ===============================================
#          успешная оплата (Telegram Payments)
# ===============================================

@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message) -> None:
    """
    Срабатывает, когда Telegram подтвердил успешный платёж.
    """
    amount = message.successful_payment.total_amount // 100

    bot.send_message(
        message.chat.id,
        f"🎉 Оплата {amount} ₽ прошла успешно!\nСпасибо за покупку ❤️",
    )

    bot.send_message(
        OWNER_CHAT_ID,
        f"💰 Клиент @{message.from_user.username or 'user'} успешно оплатил заказ на {amount} ₽",
    )


# ===============================================
#            pre_checkout (обязательный)
# ===============================================

@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query) -> None:
    """
    Обязательный хендлер Telegram Payments.
    Сейчас просто отвечаем, что всё ок.
    """
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# ===============================================
#                 /start
# ===============================================

@bot.message_handler(commands=["start"])
def handle_start_command(message: Message) -> None:
    logging.info("[BOT] handle_start_command, chat=%s", message.chat.id)
    send_actionable_message(
        chat_id=message.chat.id,
        text="Welcome to Laurel Cafe! 🌿\n\nTap the button below to open the menu.",
    )


# ===============================================
#           fallback-хендлер текста
# ===============================================

@bot.message_handler(content_types=["text"])
def handle_all_messages(message: Message) -> None:
    """
    На все остальные текстовые сообщения даём ссылку на Mini App.
    """
    logging.info(
        "[BOT] handle_all_messages, chat=%s text=%r",
        message.chat.id,
        message.text,
    )
    send_actionable_message(
        chat_id=message.chat.id,
        text="Чтобы оформить заказ, откройте меню по кнопке ниже 🙂",
    )


def send_actionable_message(chat_id: int, text: str) -> None:
    """
    Отправляем текст + inline-кнопку, которая открывает Mini App.
    """
    markup = telebot.util.quick_markup(
        {
            "Open menu": {
                "web_app": WebAppInfo(APP_URL),
            },
        },
        row_width=1,
    )

    bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=markup,
        parse_mode="Markdown",
    )


# ===============================================
#        работа с вебхуком (для Flask)
# ===============================================

def refresh_webhook() -> dict:
    """
    Снять старый webhook и поставить новый на WEBHOOK_URL + WEBHOOK_PATH.
    """
    full_url = WEBHOOK_URL.rstrip("/") + "/" + WEBHOOK_PATH.lstrip("/")

    logging.info("[BOT] refresh_webhook -> %s", full_url)

    bot.remove_webhook(drop_pending_updates=True)
    # принимаем сообщения, pre_checkout_query и успешные платежи
    bot.set_webhook(
        url=full_url,
        allowed_updates=["message", "pre_checkout_query"],
        max_connections=40,
    )

    return {"ok": True, "url": full_url}


def process_update(update_json: dict) -> None:
    """
    Получает update JSON от Flask и передаёт его TeleBot'у.
    Используется в маршруте /bot в main.py.
    """
    logging.debug("[BOT] process_update payload: %s", update_json)
    update = Update.de_json(update_json)
    bot.process_new_updates([update])
