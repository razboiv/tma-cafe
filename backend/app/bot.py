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
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/bot")
APP_URL = os.getenv("APP_URL")

# сюда поставь свой id, у тебя он уже был
OWNER_CHAT_ID = 623300887

bot = TeleBot(BOT_TOKEN, parse_mode=None)


# ---------- web_app_data из MiniApp (Checkout -> sendData()) ----------

@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message):
    """
    Сюда прилетает JSON-payload из MiniApp после CHECKOUT
    (TelegramSDK.sendData(order)).

    Здесь:
      1. Парсим заказ.
      2. Формируем красивый текст.
      3. Создаём invoice-ссылку через Telegram Payments.
      4. Отправляем клиенту ссылку на оплату.
      5. Отправляем резюме заказа владельцу.
    """
    try:
        raw = message.web_app_data.data
        logging.info("Got web_app_data: %s", raw)

        try:
            order = json.loads(raw)
        except Exception as e:
            logging.exception("Failed to parse JSON from web_app_data: %s", e)
            bot.send_message(
                message.chat.id,
                f"Пришли данные из MiniApp, но не получилось распарсить JSON:\n`{raw}`",
                parse_mode="Markdown",
            )
            return

        # ----- формируем текст заказа -----
        items_text = ""
        total = 0

        for item in order:
            caf = item.get("cafeteria", {}) or {}
            var = item.get("variant", {}) or {}

            name = caf.get("name") or caf.get("id") or "Блюдо"
            variant = var.get("name") or var.get("id") or ""
            qty = int(item.get("quantity", 1) or 1)
            price = int(item.get("cost") or 0)

            total += price * qty
            items_text += f"- {name} — {variant} × {qty} = {price * qty} ₽\n"

        summary = f"Ваш заказ:\n\n{items_text}\nИтого: {total} ₽"

        # ----- создаём счёт (invoice link) -----
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

        # ----- отправляем ссылку клиенту -----
        bot.send_message(message.chat.id, summary)
        bot.send_message(
            message.chat.id,
            f'<a href="{invoice_link}">Оплатить заказ</a>',
            parse_mode="HTML",
        )

        # ----- уведомляем владельца бизнеса -----
        bot.send_message(
            OWNER_CHAT_ID,
            f"📦 Новый заказ от @{message.from_user.username or 'клиента'}\n\n{summary}",
        )

    except Exception as e:
        logging.exception("Error in handle_web_app_data: %s", e)
        bot.send_message(
            message.chat.id,
            f"Ошибка при обработке заказа: {e}",
        )


# ---------- успешная оплата ----------

@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message):
    """
    Срабатывает автоматически после успешной оплаты.
    """
    amount = message.successful_payment.total_amount // 100

    # клиенту
    bot.send_message(
        message.chat.id,
        f"✅ Оплата {amount} ₽ прошла успешно!\nСпасибо за покупку ❤️",
    )

    # владельцу
    bot.send_message(
        OWNER_CHAT_ID,
        f"💰 Клиент @{message.from_user.username or 'user'} "
        f"успешно оплатил заказ на {amount} ₽",
    )


# ---------- pre_checkout (обязательный хэндлер Telegram Payments) ----------

@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query):
    """
    Здесь можно проверить, что товары ещё доступны, и либо ok=True, либо ok=False.
    В демо всегда отвечаем ok=True.
    """
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# ---------- /start ----------

@bot.message_handler(func=lambda message: re.match(r"^/start", message.text or "", re.IGNORECASE) is not None)
def handle_start_command(message: Message):
    """
    Хэндлер для /start — шлёт кнопку, которая открывает Mini App.
    """
    send_actionable_message(
        chat_id=message.chat.id,
        text="Welcome to Laurel Cafe! 🌿\n\nTap the button below to open the menu.",
    )


# ---------- fallback на любые другие сообщения ----------

@bot.message_handler()
def handle_all_messages(message: Message):
    """
    Фоллбек, если ничего не сматчило.
    """
    send_actionable_message(
        chat_id=message.chat.id,
        text=(
            "Честно говоря, я не знаю, как ответить на это сообщение.\n"
            "Но вы всегда можете открыть меню по кнопке ниже 🙂"
        ),
    )


# ---------- общий метод отправки сообщения с web-app-кнопкой ----------

def send_actionable_message(chat_id: int, text: str):
    """
    Шлёт текст + inline-кнопку, которая открывает Mini App.
    """
    markup = quick_markup(
        {
            "Open shop": {
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


# ---------- служебные функции для web-хука ----------

def refresh_webhook():
    """Удалить старый и выставить новый webhook."""
    bot.remove_webhook()
    bot.set_webhook(WEBHOOK_URL + WEBHOOK_PATH)


def process_update(update_json):
    """
    Вызывается из Flask-бэкенда.
    Передаём JSON-update в TeleBot.
    """
    update = Update.de_json(update_json)
    bot.process_new_updates([update])


def enable_debug_logging():
    """Включить подробные логи TeleBot (полезно при разработке)."""
    telebot.logger.setLevel(logging.DEBUG)
