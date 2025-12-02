from flask import Flask, request, jsonify
from bot import bot, process_update
import os

app = Flask(__name__)

WEBHOOK_URL = "https://tma-cafe-backend.onrender.com/bot"


@app.route("/", methods=["GET"])
def home():
    return "OK", 200


@app.route("/bot", methods=["POST"])
def bot_webhook():
    try:
        process_update(request.get_json())
    except Exception as e:
        print("Error:", e)
    return jsonify({"status": "ok"}), 200


@app.route("/refresh_webhook", methods=["GET"])
def refresh_webhook():
    bot.remove_webhook()
    bot.set_webhook(WEBHOOK_URL)
    return jsonify({"status": "webhook refreshed"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
