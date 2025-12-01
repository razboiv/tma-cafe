import telebot
import os

TOKEN = os.getenv("BOT_TOKEN")
bot = telebot.TeleBot(TOKEN, parse_mode="HTML")


def process_update(json_data):
    if not json_data:
        return
    update = telebot.types.Update.de_json(json_data)
    bot.process_new_updates([update])


@bot.message_handler(commands=['start'])
def start(msg):
    bot.send_message(msg.chat.id, "Бот работает!")
