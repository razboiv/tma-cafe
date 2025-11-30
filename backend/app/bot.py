import telebot
from telebot import types

TOKEN = "ТВОЙ_ТОКЕН_БОТА"
bot = telebot.TeleBot(TOKEN, threaded=False)


@bot.message_handler(commands=['start'])
def start(message):
    bot.send_message(message.chat.id, "Бот работает!")


@bot.pre_checkout_query_handler(func=lambda q: True)
def checkout(q: types.PreCheckoutQuery):
    bot.answer_pre_checkout_query(q.id, ok=True)
    bot.send_message(q.from_user.id, "Оплата успешно прошла!")


def process_update(update_json):
    update = telebot.types.Update.de_json(update_json)
    bot.process_new_updates([update])
