# backend/app/bot.py
import os
import logging
import json
import telebot
from telebot.types import Message, WebAppInfo, Update
from telebot.util import quick_markup

BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")
WEBHOOK_PATH = os.getenv("WEBHOOK_PATH", "/bot")
APP_URL = os.getenv("APP_URL")
OWNER_CHAT_ID = 62330887

bot = telebot.TeleBot(BOT_TOKEN, parse_mode=None)
telebot.logger.setLevel(logging.DEBUG)

# ---------------------------------------------------
# REFRESH WEBHOOK
# ---------------------------------------------------
def refresh_webhook():
    bot.remove_webhook()
    bot.set_webhook(url=WEBHOOK_URL + "/" + WEBHOOK_PATH)


# ---------------------------------------------------
# PROCESS UPDATE FROM FLASK
# ---------------------------------------------------
def process_update(update_json: dict):
    update = Update.de_json(update_json)
    bot.process_new_updates([update])


# ---------------------------------------------------
# HANDLER: WEB APP DATA
# ---------------------------------------------------
@bot.message_handler(content_types=["web_app_data"])
def handle_web_app(message: Message):
    try:
        data = json.loads(message.web_app_data.data)
    except:
        bot.send_message(message.chat.id, "❌ Ошибка чтения JSON")
        return

    items = data if isinstance(data, list) else []
    total = 0
    lines = []

    for item in items:
        name = item.get("cafeteria", {}).get("name", "Товар")
        variant = item.get("variant", {}).get("name", "")
        qty = int(item.get("quantity", 1))
        price = int(item.get("cost", 0))

        total += price * qty
        lines.append(f"{name} {variant} × {qty} = {price * qty} ₽")

    summary = "Ваш заказ:\n" + "\n".join(lines) + f"\n\nИтого: {total} ₽"

    # отправляем invoice
    invoice = bot.create_invoice_link(
        title="Оплата заказа",
        description="Оплата заказа в Mini App",
        payload="order",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True,
    )

    bot.send_message(message.chat.id, summary)
    bot.send_message(message.chat.id,
        f"<a href=\"{invoice}\">💳 Оплатить заказ</a>",
        parse_mode="HTML"
    )

    bot.send_message(
        OWNER_CHAT_ID,
        f"🆕 Новый заказ от @{message.from_user.username}\n" + summary
    )


# ---------------------------------------------------
# PAYMENT SUCCESS
# ---------------------------------------------------
@bot.message_handler(content_types=['successful_payment'])
def payment_success(message: Message):
    amount = message.successful_payment.total_amount // 100

    bot.send_message(message.chat.id, f"✅ Оплата {amount} ₽ прошла успешно!")
    bot.send_message(OWNER_CHAT_ID,
        f"💰 Клиент @{message.from_user.username} оплатил {amount} ₽")

# ---------------------------------------------------
# PRE CHECKOUT
# ---------------------------------------------------
@bot.pre_checkout_query_handler(func=lambda q: True)
def checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

# ---------------------------------------------------
# START
# ---------------------------------------------------
@bot.message_handler(commands=['start'])
def start(message: Message):
    markup = quick_markup({
        "Open menu": {"web_app": WebAppInfo(url=APP_URL)}
    }, row_width=1)

    bot.send_message(message.chat.id,
        "Welcome! Tap the button to open the menu 👇",
        reply_markup=markup
    )

# ---------------------------------------------------
# FALLBACK
# ---------------------------------------------------
@bot.message_handler(func=lambda m: True)
def fallback(message: Message):
    markup = quick_markup({
        "Open menu": {"web_app": WebAppInfo(url=APP_URL)}
    }, row_width=1)

    bot.send_message(message.chat.id,
        "Открой меню, чтобы сделать заказ 🙂",
        reply_markup=markup
    )
