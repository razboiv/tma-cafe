from flask import Flask, request, jsonify
from bot import bot, process_update

app = Flask(__name__)


@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "ok"})


@app.route("/bot", methods=["POST"])
def webhook():
    process_update(request.json)
    return "", 200


@app.route("/refresh_webhook", methods=["GET"])
def refresh_webhook():
    url = "https://tma-cafe-backend.onrender.com/bot"
    bot.remove_webhook()
    bot.set_webhook(url=url, allowed_updates=["message", "pre_checkout_query"])
    return jsonify({"message": "Webhook refreshed"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
