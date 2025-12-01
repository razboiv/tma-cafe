import telebot
import os

TOKEN = os.getenv("BOT_TOKEN")

bot = telebot.TeleBot(TOKEN, threaded=False)

def process_update(update_json):
    update = telebot.types.Update.de_json(update_json)
    bot.process_new_updates([update])

@bot.message_handler(commands=["start"])
def start(message):
    bot.send_message(message.chat.id, "Бот работает!")
