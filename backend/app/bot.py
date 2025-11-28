import os
import json
import logging
import telebot
from telebot import TeleBot
from telebot.types import Message, WebAppInfo
from telebot.util import quick_markup

# ----- CONFIG -----

BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")     # например: https://tma-cafe-backend.onrender.com
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH")   # /bot
APP_URL = os.getenv("APP_URL")             # https://luvcore.shop
OWNER_CHAT_ID = int(os.getenv("OWNER_CHAT_ID", 0))  # id владельца

bot = TeleBot(BOT_TOKEN, parse_mode="HTML")

# ----- DEBUG -----
telebot.logger.setLevel(logging.DEBUG)


# ======================================================
#                 Web App -> sendData()
# ======================================================
@bot.message_handler(content_types=["web_app_data"])
def handle_web_app_data(message: Message):
    """
    Получает заказ из MiniApp через Telegram.WebApp.sendData()
    """
    raw = message.web_app_data.data
    logging.info("Got web_app_data: %s", raw)

    try:
        order = json.loads(raw)
    except Exception:
        order = None

    if order is None:
        bot.send_message(message.chat.id, f"❌ Ошибка: не удалось распарсить JSON\n<code>{raw}</code>")
        return

    # ---- Формируем текст заказа ----
    items_text = ""
    total = 0

    for item in order:
        name = item["cafeteria"]["name"]
        variant = item["variant"]["name"]
        qty = item["quantity"]
        price = item["cost"]

        total += price * qty
        items_text += f"• <b>{name}</b> — {variant} × {qty} = {price * qty}₽\n"

    summary = f"<b>Ваш заказ:</b>\n{items_text}\n<b>Итого: {total}₽</b>"

    # ---- Создаем invoice link ----
    invoice = bot.create_invoice_link(
        title="Оплата заказа",
        description="Оплата покупки",
        payload="order_payload",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True
    )

    # ---- Отправляем клиенту ----
    bot.send_message(message.chat.id, summary)
    bot.send_message(message.chat.id, f'<a href="{invoice}">💳 Оплатить заказ</a>', parse_mode="HTML")

    # ---- Уведомляем владельца ----
    if OWNER_CHAT_ID:
        bot.send_message(
            OWNER_CHAT_ID,
            f"🆕 Новый заказ от @{message.from_user.username or 'клиента'}:\n\n{summary}"
        )


# ======================================================
#                   УСПЕШНЫЙ ПЛАТЕЖ
# ======================================================
@bot.message_handler(content_types=["successful_payment"])
def handle_successful_payment(message: Message):
    amount = message.successful_payment.total_amount // 100
    bot.send_message(message.chat.id, f"🎉 Оплата {amount}₽ прошла успешно!\nСпасибо за покупку ❤️")

    # Уведомляем владельца
    if OWNER_CHAT_ID:
        bot.send_message(
            OWNER_CHAT_ID,
            f"💰 Клиент @{message.from_user.username or 'user'} успешно оплатил заказ на {amount}₽"
        )


# ======================================================
#               PRE CHECKOUT (обязательный)
# ======================================================
@bot.pre_checkout_query_handler(func=lambda q: True)
def checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


# ======================================================
#                     /start
# ======================================================
@bot.message_handler(commands=["start"])
def handle_start(message: Message):
    markup = quick_markup({
        "Открыть меню": {"web_app": WebAppInfo(APP_URL)}
    }, row_width=1)

    bot.send_message(
        message.chat.id,
        "👋 Привет! Открой меню ниже:",
        reply_markup=markup
    )


# ======================================================
#              Fallback — любое сообщение
# ======================================================
@bot.message_handler(func=lambda m: True)
def fallback(message: Message):
    bot.send_message(message.chat.id, "Нажмите кнопку ниже, чтобы открыть меню 👇")


# ======================================================
#               Refresh webhook (вызывается Flask)
# ======================================================
def refresh_webhook():
    bot.remove_webhook()
    bot.set_webhook(WEBHOOK_URL + WEBHOOK_PATH)
    logging.info("Webhook updated to %s", WEBHOOK_URL + WEBHOOK_PATH)


# ======================================================
# старт бота в режиме polling (локально)
# ======================================================
if __name__ == "__main__":
    bot.infinity_polling()
