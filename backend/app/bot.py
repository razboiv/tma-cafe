import logging
import os
import re
import telebot
import json
from telebot import TeleBot
from telebot.types import Update, WebAppInfo, Message
from telebot.util import quick_markup

BOT_TOKEN=os.getenv('BOT_TOKEN')
PAYMENT_PROVIDER_TOKEN=os.getenv('PAYMENT_PROVIDER_TOKEN')
WEBHOOK_URL=os.getenv('WEBHOOK_URL')
WEBHOOK_PATH='/bot'
APP_URL=os.getenv('APP_URL')
OWNER_CHAT_ID = 623300087

bot = TeleBot(BOT_TOKEN, parse_mode=None)

@bot.message_handler(content_types=['web_app_data'])
def handle_web_app_data(message):
    """
    Обрабатывает sendData(order) из MiniApp.
    Здесь приходит JSON с заказом.
    После этого мы отправляем пользователю ссылку на оплату.
    """

    try:
        order = json.loads(message.web_app_data.data)
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка данных: {e}")
        return

    # ---------- формируем красивый текст заказа ----------
    items_text = ""
    total = 0
    for item in order:
        name = item['cafeteria']['name']
        variant = item['variant']['name']
        qty = item['quantity']
        price = item['cost']
        total += price * qty
        items_text += f"• {name} — {variant} × {qty} = {price * qty} ₽\n"

    summary = f"Ваш заказ:\n\n{items_text}\nИтого: {total} ₽"

    # ---------- создаём счёт (invoice link) ----------
    invoice_link = bot.create_invoice_link(
        title="Оплата заказа",
        description="Оплата покупки в Laurel Cafe",
        payload="order_payload",
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=[{"label": "Заказ", "amount": total * 100}],
        need_name=True,
        need_phone_number=True
    )

    # ---------- отправляем ссылку клиенту ----------
    bot.send_message(message.chat.id, summary)
    bot.send_message(message.chat.id, "Перейдите к оплате:", reply_markup=None)

    bot.send_message(
        message.chat.id,
        f"👉 <a href=\"{invoice_link}\">Оплатить заказ</a>",
        parse_mode="HTML"
    )

    # ---------- уведомляем владельца бизнеса ----------
    bot.send_message(
        OWNER_CHAT_ID,
        f"❗ Новый заказ от @{message.from_user.username or 'клиента'}\n\n{summary}"
    )


# -------------------- успешная оплата --------------------
@bot.message_handler(content_types=['successful_payment'])
def handle_successful_payment(message):
    """
    Срабатывает автоматически после оплаты.
    """

    amount = message.successful_payment.total_amount // 100
    bot.send_message(
        message.chat.id,
        f"✅ Оплата {amount} ₽ прошла успешно!\nСпасибо за покупку ❤️"
    )

    # Сообщаем владельцу:
    bot.send_message(
        OWNER_CHAT_ID,
        f"💰 Клиент @{message.from_user.username or 'user'} успешно оплатил заказ на {amount} ₽"
    )

@bot.message_handler(content_types=['successful_payment'])

@bot.pre_checkout_query_handler(func=lambda _: True)
def handle_pre_checkout_query(pre_checkout_query):
    """Here we may check if ordered items are still available.
      Since this is an example project, all the items are always in stock, so we answer query is OK.
      For other cases, when you perform a check and find out that you can't sell the items,
      you need to answer ok=False.
      Keep in mind: The check operation should not be longer than 10 seconds. If the Telegram API
      doesn't receive answer in 10 seconds, it cancels checkout.
    """
    bot.answer_pre_checkout_query(pre_checkout_query_id=pre_checkout_query.id, ok=True)

@bot.message_handler(func=lambda message: re.match(r'/?start', message.text, re.IGNORECASE) is not None)
def handle_start_command(message):
    """Message handler for start messages, including '/start' command. This is an example how to
      use Regex for handling desired type of message. E.g. this handlers applies '/start', 
      '/START', 'start', 'START', 'sTaRt' and so on.
    """
    send_actionable_message(
        chat_id=message.chat.id,
        text='*Welcome to Laurel Cafe!* 🌿\n\nIt is time to order something delicious 😋 Tap the button below to get started.'
    )

@bot.message_handler()
def handle_all_messages(message):
    """Fallback message handler that is invoced if none of above aren't match. This is a good
      practice to handle all the messages instead of ignoring unknown ones. In our case, we let user
      know that we can't handle the message and just advice to explore the menu using inline button.
    """
    send_actionable_message(
        chat_id=message.chat.id,
        text="To be honest, I don't know how to reply to messages. But I can offer you to familiarize yourself with our menu. I am sure you will find something to your liking! 😉"
    )

def send_actionable_message(chat_id, text):
    """Method allows to send the text to the chat and attach inline button to it.
      Inline button will open our Mini App on click.
    """
    markup = quick_markup({
        'Explore Menu': { 
            'web_app': WebAppInfo(APP_URL)
        },
    }, row_width=1)
    bot.send_message(
        chat_id=chat_id,
        text=text,
        parse_mode='markdown',
        reply_markup=markup
    )

def refresh_webhook():
    """Just a wrapper for remove & set webhook ops"""
    bot.remove_webhook()
    bot.set_webhook(WEBHOOK_URL + WEBHOOK_PATH)

def process_update(update_json):
    """Pass received Update JSON to the Bot for processing.
      This method should be typically called from the webhook method.
      
    Args:
        update_json: Update object sent from the Telegram API. See https://core.telegram.org/bots/api#update.
    """
    update = Update.de_json(update_json)
    bot.process_new_updates([update])

def create_invoice_link(prices) -> str:
    """Just a handy wrapper for creating an invoice link for payment. Since this is an example project,
      most of the fields are hardcode.
    """
    return bot.create_invoice_link(
        title='Order #1',
        description='Great choice! Last steps and we will get to cooking ;)',
        payload='orderID',
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency='USD',
        prices=prices,
        need_name=True,
        need_phone_number=True,
        need_shipping_address=True
    )

def enable_debug_logging():
    """Display all logs from the Bot. May be useful while developing."""
    telebot.logger.setLevel(logging.DEBUG)
