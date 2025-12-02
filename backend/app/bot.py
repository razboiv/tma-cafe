import telebot
import os

TOKEN = os.getenv("BOT_TOKEN")
bot = telebot.TeleBot(TOKEN, threaded=False)

@bot.message_handler(commands=["start"])
def start(message):
    bot.send_message(message.chat.id, "Бот работает!")

@bot.pre_checkout_query_handler(func=lambda q: True)
def checkout(pre_checkout_query):
    bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

def process_update(update_json):
    update = telebot.types.Update.de_json(update_json)
    bot.process_new_updates([update])
