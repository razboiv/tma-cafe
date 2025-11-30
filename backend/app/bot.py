# backend/app/bot.py
import logging
import os
import re
import json

import telebot
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup

# ---------- ENV ----------
BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")

WEBHOOK_URL = os.getenv("WEBHOOK_URL")            # https://tma-cafe-backend.onrender.com
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "bot")   # bot или /bot
APP_URL = os.getenv("APP_URL")                    # https://luvcore.shop  (Mini App)
OWNER_CHAT_ID = int(os.getenv("OWNER_CHAT_ID", "0"))

# нормализуем путь
if not WEBHOOK_PATH.startswith("/"):
    WEBHOOK_PATH = "/" + WEBHOOK_PATH

bot = TeleBot(BOT_TOKEN, parse_mode=None)


def enable_debug_logging() -> None:
    telebot.logger.setLevel(logging.DEBUG)


# ---------- Mini App -> sendData(order) ----------
@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message) -> None:
    """
    Принимаем JSON заказа из Mini App (Checkout -> TelegramSDK.sendData()).
    """
    raw = message.web_app_data.data
    logging.info("[BOT] got web_app_data: %s", raw)

    try:
        order = json.loads(raw)
    except Exception as e:  # noqa: BLE001
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

    # -------- формируем текст и сумму --------
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

        items_text += f"{name} {variant} × {qty} = {price * qty} ₽\n"

    summary = f"Ваш заказ:\n\n{items_text}\nИтого: {total} ₽"

    # ---------- создаём invoice link ----------
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

    # ---------- отправляем клиенту ----------
    bot.send_message(message.chat.id, summary)
    bot.send_message(message.chat.id, "Перейдите к оплате по ссылке ниже:")
    bot.send_message(
        message.chat.id,
        f'<a href="{invoice_link}">Оплатить заказ</a>',
        parse_mode="HTML",
    )

    # ---------- уведомляем владельца ----------
    username = message.from_user.username or "клиента"
    bot.send_message(
        OWNER_CHAT_ID,
        f"Новый заказ от @{username}\n\n{summary}",
    )


# ---------- успешная оплата ----------
@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message) -> None:
    amount = message.successful_payment.total_amount / 100

    bot.send_message(
        message.chat.id,
        f"✅ Оплата {amount:.0f} ₽ прошла успешно!\nСпасибо за покупку ❤️",
    )

    username = message.from_user.username or "user"
    bot.send_message(
        OWNER_CHAT_ID,
        f"💰 Клиент @{username} успешно оплатил заказ на {amount:.0f} ₽",
    )


# ---------- pre_checkout (обязательный хендлер) ----------
@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# ---------- /start ----------
@bot.message_handler(func=lambda m: re.match(r"^/start", m.text or "", re.IGNORECASE))
def handle_start_command(message: Message) -> None:
    send_actionable_message(
        chat_id=message.chat.id,
        text="Welcome to Laurel Cafe! 🌿\n\nTap the button below to open the menu.",
    )


# ---------- fallback ----------
@bot.message_handler()
def handle_all_messages(message: Message) -> None:
    send_actionable_message(
        chat_id=message.chat.id,
        text="Чтобы оформить заказ, откройте меню по кнопке ниже 🙂",
    )


def send_actionable_message(chat_id: int, text: str) -> None:
    markup = quick_markup(
        {
            "Open menu": {
                "web_app": WebAppInfo(APP_URL),
            }
        },
        row_width=1,
    )

    bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=markup,
        parse_mode="Markdown",
    )


# ---------- работа с вебхуком (вызывает Flask) ----------
def refresh_webhook() -> str:
    """
    Снимаем старый webhook и ставим новый на WEBHOOK_URL + WEBHOOK_PATH.
    """
    bot.remove_webhook()  # без drop_pending_updates — у тебя старая версия pyTelegramBotAPI
    url = WEBHOOK_URL.rstrip("/") + WEBHOOK_PATH
    bot.set_webhook(url)
    return url


def process_update(update_json: dict) -> None:
    """
    Получает update JSON от Flask и передаёт его TeleBot'у.
    """
    update = Update.de_json(update_json)
    bot.process_new_updates([update])
