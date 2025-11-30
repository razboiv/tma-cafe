# backend/app/bot.py
import logging
import os
import json
import re

import telebot
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup


# ------------ ENV / настройки ------------

BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
APP_URL = os.getenv("APP_URL")  # https://luvcore.shop (Mini App)
WEBHOOK_URL = os.getenv("WEBHOOK_URL")  # https://tma-cafe-backend.onrender.com
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/bot")  # bot или /bot
OWNER_CHAT_ID = int(os.getenv("OWNER_CHAT_ID", "623300887"))

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN is not set")

bot: TeleBot = TeleBot(BOT_TOKEN, parse_mode="Markdown")


# ------------ логирование ------------

def enable_debug_logging() -> None:
    """
    Включаем подробные логи и для TeleBot, и для нашего кода.
    Вызывается из main.py.
    """
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    telebot.logger.setLevel(logging.DEBUG)
    logging.getLogger(__name__).info("Debug logging enabled for bot")


# ------------ вспомогалки ------------

def _build_webhook_url() -> str:
    """
    Склеиваем WEBHOOK_URL и WEBHOOK_PATH, аккуратно убирая/добавляя слеши.
    """
    base = (WEBHOOK_URL or "").rstrip("/")
    path = (WEBHOOK_PATH or "/bot").lstrip("/")
    if not base:
        raise RuntimeError("WEBHOOK_URL is not set")
    return f"{base}/{path}"


def send_actionable_message(chat_id: int, text: str) -> None:
    """
    Отправляет текст + кнопку, которая открывает Mini App.
    """
    if not APP_URL:
        bot.send_message(chat_id, "APP_URL не настроен на сервере.")
        return

    markup = quick_markup(
        {
            "Открыть меню": {
                "web_app": WebAppInfo(APP_URL),
            }
        },
        row_width=1,
    )

    logging.debug("Sending actionable message to chat %s", chat_id)
    bot.send_message(
        chat_id=chat_id,
        text=text,
        reply_markup=markup,
    )


# ------------ /start ------------

@bot.message_handler(commands=["start"])
def handle_start_command(message: Message) -> None:
    """
    Обработчик /start — отправляем кнопку с Mini App.
    """
    logging.debug("handle_start_command: chat_id=%s text=%r",
                  message.chat.id, message.text)
    send_actionable_message(
        chat_id=message.chat.id,
        text="Welcome to Laurel Cafe! 🌿\n\nTap the button below to open the menu.",
    )


# ------------ fallback: любые текстовые сообщения ------------

@bot.message_handler(content_types=["text"])
def handle_all_text(message: Message) -> None:
    """
    На все остальные текстовые сообщения просто даём ссылку на Mini App.
    """
    logging.debug("handle_all_text: chat_id=%s text=%r",
                  message.chat.id, message.text)
    send_actionable_message(
        chat_id=message.chat.id,
        text="Чтобы оформить заказ, откройте меню по кнопке ниже 🙂",
    )


# ------------ Mini App -> web_app_data (Checkout) ------------

@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message) -> None:
    """
    Сюда Mini App шлёт JSON с заказом (Checkout -> Telegram.WebApp.sendData()).
    """
    raw = message.web_app_data.data
    logging.debug("[BOT] got web_app_data: %s", raw)

    # 1) парсим JSON
    try:
        order = json.loads(raw)
    except Exception as e:
        logging.exception("Failed to parse web_app_data JSON")
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

    # 2) считаем сумму и текст
    items_text = ""
    total = 0

    for item in order:
        if not isinstance(item, dict):
            continue

        caf = item.get("cafeteria") or {}
        var = item.get("variant") or {}
        qty = int(item.get("quantity") or 1)
        price = int(item.get("cost") or 0)

        name = caf.get("name", "Товар")
        variant = var.get("name", "")
        total += price * qty

        items_text += f"{name} {variant} × {qty} = {price * qty} ₽\n"

    summary = f"Ваш заказ:\n\n{items_text}\nИтого: {total} ₽"

    # 3) если нет платежного токена — просто отправляем заказ без оплаты
    if not PAYMENT_PROVIDER_TOKEN:
        logging.warning("PAYMENT_PROVIDER_TOKEN is not set; skipping invoice")
        bot.send_message(message.chat.id, summary)
        bot.send_message(
            message.chat.id,
            "Платёжный провайдер не настроен, свяжитесь с админом.",
        )
        return

    # 4) создаём invoice-link
    invoice_link = bot.create_invoice_link(
        title="Оплата заказа",
        description="Оплата покупок в Laurel Cafe",
        payload="order_payload",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True,
    )

    # 5) отправляем ссылку клиенту
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

    # 6) уведомляем владельца
    bot.send_message(
        OWNER_CHAT_ID,
        f"🆕 Новый заказ от @{message.from_user.username or 'клиента'}\n\n{summary}",
    )


# ------------ pre_checkout (обязательный хендлер) ------------

@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query) -> None:
    """
    Telegram перед платежом обязательно вызывает этот хендлер.
    Сейчас просто подтверждаем, что всё ок.
    """
    logging.debug("handle_pre_checkout_query: id=%s",
                  pre_checkout_query.id)
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# ------------ успешная оплата ------------

@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message) -> None:
    """
    Срабатывает, когда Telegram подтверждает успешный платёж.
    """
    amount = message.successful_payment.total_amount // 100
    logging.debug(
        "handle_successful_payment: chat_id=%s amount=%s",
        message.chat.id,
        amount,
    )

    # клиенту
    bot.send_message(
        message.chat.id,
        f"💳 Оплата {amount} ₽ прошла успешно!\nСпасибо за покупку ❤️",
    )

    # владельцу
    bot.send_message(
        OWNER_CHAT_ID,
        f"✅ Клиент @{message.from_user.username or 'user'} "
        f"успешно оплатил заказ на {amount} ₽",
    )


# ------------ работа с вебхуком (для main.py) ------------

def refresh_webhook() -> None:
    """
    Снять старый webhook и поставить новый на
    WEBHOOK_URL + WEBHOOK_PATH.
    """
    url = _build_webhook_url()
    logging.getLogger(__name__).info("Refreshing webhook to %s", url)

    bot.remove_webhook()
    bot.set_webhook(
        url=url,
        allowed_updates=["message", "pre_checkout_query", "successful_payment"],
        max_connections=40,
    )


def process_update(update_json: dict) -> None:
    """
    main.py передаёт сюда JSON апдейта, а дальше TeleBot
    сам разруливает все хендлеры.
    """
    update = Update.de_json(update_json)
    bot.process_new_updates([update])
