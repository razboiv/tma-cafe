import os
from flask import Flask, request, jsonify
from telebot import TeleBot, types
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
APP_URL = "https://tma-cafe-backend.onrender.com"

bot = TeleBot(TOKEN, threaded=False)

# --------------------------------------------------------
# Flask App
# --------------------------------------------------------

app = Flask(__name__)

# ------- CORS для фронта -------
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

# --------------------------------------------------------
# Telegram Webhook обработка
# --------------------------------------------------------

@app.route("/bot", methods=["POST"])
def process_update():
    json_data = request.get_json(force=True)
    bot.process_new_updates([TeleBot().update_from_json(json_data)])
    return "OK", 200


# --------------------------------------------------------
# Команда /start
# --------------------------------------------------------

@bot.message_handler(commands=["start"])
def start(message):
    bot.send_message(message.chat.id, "Бот работает! Можешь тестировать заказ 😊")


# --------------------------------------------------------
# Обработка обычных сообщений — ОБЯЗАТЕЛЬНО!!!
# --------------------------------------------------------

@bot.message_handler(func=lambda msg: True)
def echo_all(message):
    bot.send_message(message.chat.id, f"Ты написал: {message.text}")


# --------------------------------------------------------
# Telegram Payment (CHECKOUT)
# --------------------------------------------------------

@bot.pre_checkout_query_handler(func=lambda q: True)
def checkout_pre(q):
    bot.answer_pre_checkout_query(q.id, ok=True)


@bot.message_handler(content_types=["successful_payment"])
def checkout_success(message):
    bot.send_message(
        message.chat.id,
        f"Оплата прошла успешно! Сумма: {message.successful_payment.total_amount / 100} ₽"
    )


# --------------------------------------------------------
# Health-check
# --------------------------------------------------------

@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "ok"})


# --------------------------------------------------------
# Webhook refresh
# --------------------------------------------------------

@app.route("/refresh_webhook", methods=["GET"])
def refresh_webhook():
    bot.remove_webhook()
    bot.set_webhook(url=f"{APP_URL}/bot", allowed_updates=["message", "pre_checkout_query", "successful_payment"])
    return jsonify({"message": "Webhook refreshed"})


# --------------------------------------------------------
# Run
# --------------------------------------------------------

if __name__ == "__main__":
    bot.remove_webhook()
    bot.set_webhook(url=f"{APP_URL}/bot", allowed_updates=["message", "pre_checkout_query", "successful_payment"])
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
