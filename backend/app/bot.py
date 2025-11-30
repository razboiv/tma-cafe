# backend/app/bot.py
import logging
import os
import re
import json

import telebot
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup

# ------------ ENV ------------

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN", "")
APP_URL = os.getenv("APP_URL", "")
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "bot")
OWNER_CHAT_ID = int(os.getenv("OWNER_CHAT_ID", "623300887"))

# ------------ bot ------------

bot = TeleBot(BOT_TOKEN, parse_mode="HTML")


def enable_debug_logging() -> None:
    """Включаем подробные логи TeleBot (видно в Render-логах)."""
    telebot.logger.setLevel(logging.DEBUG)
    logging.getLogger(__name__).setLevel(logging.DEBUG)
    logging.debug(
        "[BOT] Debug logging enabled. BOT_TOKEN set: %s, APP_URL: %s",
        bool(BOT_TOKEN),
        APP_URL,
    )


# ------------ WebApp -> sendData(order) ------------


@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message) -> None:
    """
    Сюда прилетает JSON с заказом из MiniApp (Checkout -> TelegramSDK.sendData()).
    Для отладки сейчас просто шлём сырой JSON тебе и клиенту.
    """
    raw = message.web_app_data.data
    logging.info("[BOT] got web_app_data: %s", raw)

    try:
        order = json.loads(raw)
    except Exception as e:
        logging.exception("Failed to parse web_app_data JSON: %s", e)
        bot.send_message(
            message.chat.id,
            f"Ошибка разбора заказа: <code>{e}</code>",
        )
        return

    bot.send_message(
        message.chat.id,
        f"✅ Заказ получен!\n<code>{json.dumps(order, ensure_ascii=False, indent=2)}</code>",
    )

    # Владелец
    bot.send_message(
        OWNER_CHAT_ID,
        f"🧾 Новый заказ от @{message.from_user.username or 'client'}:\n"
        f"<code>{json.dumps(order, ensure_ascii=False, indent=2)}</code>",
    )


# ------------ успешная оплата (Telegram Payments) ------------


@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message) -> None:
    """
    Срабатывает, когда Telegram подтверждает успешный платёж.
    """
    amount = message.successful_payment.total_amount // 100
    logging.info("[BOT] successful_payment for %s RUB", amount)

    # клиенту
    bot.send_message(
        message.chat.id,
        f"💸 Оплата {amount} ₽ прошла успешно! Спасибо за покупку ❤️",
    )

    # владельцу
    bot.send_message(
        OWNER_CHAT_ID,
        f"💸 Клиент @{message.from_user.username or 'user'} "
        f"успешно оплатил заказ на {amount} ₽",
    )


# ------------ pre_checkout (обязательный хендлер Telegram) ------------


@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query):
    """
    Здесь можно проверять наличие товара и т.п.
    Сейчас просто говорим Telegram, что всё ок.
    """
    logging.info("[BOT] pre_checkout_query: %s", pre_checkout_query.id)
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# ------------ /start ------------


@bot.message_handler(
    func=lambda m: re.match(r"^/start", (m.text or "").strip(), re.IGNORECASE) is not None
)
def handle_start_command(message: Message) -> None:
    """
    Обработчик /start — отправляем простой текст + кнопку с Mini App.
    """
    logging.info("[BOT] handle_start_command, chat_id=%s, text=%r", message.chat.id, message.text)

    # 1) очень простой тест, чтобы точно увидеть сообщение
    bot.send_message(message.chat.id, "Тест: бот получил /start ✅")

    # 2) нормальное приветствие с кнопкой
    send_actionable_message(
        chat_id=message.chat.id,
        text="Welcome to Laurel Cafe! 🌿\n\nНажмите кнопку ниже, чтобы открыть меню.",
    )


# ------------ fallback-хендлер ------------


@bot.message_handler()
def handle_all_messages(message: Message) -> None:
    """
    На все остальные сообщения просто даём ссылку на Mini App.
    """
    logging.info("[BOT] handle_all_messages, chat_id=%s, text=%r", message.chat.id, message.text)
    send_actionable_message(
        chat_id=message.chat.id,
        text="Чтобы оформить заказ, откройте меню по кнопке ниже 🙂",
    )


def send_actionable_message(chat_id: int, text: str) -> None:
    """
    Отправляем текст + inline-кнопку, которая открывает Mini App.
    """
    logging.info("[BOT] send_actionable_message to %s (APP_URL=%s)", chat_id, APP_URL)

    if not APP_URL:
        # если не настроен APP_URL — хотя бы текст
        bot.send_message(chat_id, text + "\n\n(APP_URL не задан на сервере)")
        return

    markup = quick_markup(
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
    )


# ------------ работа с вебхуком (вызывает Flask) ------------


def _build_webhook_url() -> str:
    """
    Собираем полный URL вебхука из WEBHOOK_URL + WEBHOOK_PATH.
    Защита от двойных слэшей.
    """
    base = WEBHOOK_URL.rstrip("/")
    path = WEBHOOK_PATH.lstrip("/")
    full = f"{base}/{path}"
    logging.info("[BOT] webhook URL to set: %s", full)
    return full


def refresh_webhook() -> None:
    """
    Снять старый webhook и поставить новый на WEBHOOK_URL + WEBHOOK_PATH.
    """
    logging.info("[BOT] removing previous webhook")
    bot.remove_webhook()
    url = _build_webhook_url()
    logging.info("[BOT] setting new webhook: %s", url)
    bot.set_webhook(url=url, allowed_updates=["message", "pre_checkout_query", "successful_payment"])


def process_update(update_json: dict) -> None:
    """
    Получает update JSON от Flask и передаёт его TeleBot'у.
    Используется в маршруте /bot в main.py.
    """
    logging.debug("[BOT] process_update got json: %s", update_json)
    update = Update.de_json(update_json)
    bot.process_new_updates([update])
