# backend/app/main.py
import os
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS

# ВАЖНО: импорт из app.bot, а не просто bot
from app.bot import bot, process_update, refresh_webhook

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})


@app.route("/")
def index():
    return jsonify(
        {
            "backend_url": "",
            "env": "production",
            "version": "mini-patch-2025-11-11",
        }
    )


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/webhook_test")
def webhook_test():
    return jsonify({"message": "webhook is alive"})


@app.route("/refresh_webhook")
def refresh_webhook_route():
    try:
        refresh_webhook()
        return jsonify({"status": "ok"})
    except Exception:
        app.logger.exception("error in /refresh_webhook")
        return jsonify({"message": "Internal server error"}), 500


@app.route("/bot", methods=["GET", "POST"])
def bot_route():
    if request.method == "GET":
        # Telegram иногда делает GET — просто отвечаем, что живы
        return jsonify({"message": "webhook is alive"})

    try:
        update_json = request.get_json(force=True, silent=False)
        logging.info("got update json: %s", update_json)
        process_update(update_json)
        return jsonify({"status": "ok"})
    except Exception:
        app.logger.exception("error in /bot")
        return jsonify({"message": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
