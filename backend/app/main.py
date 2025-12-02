import os

from flask import Flask, request, jsonify
from flask_cors import CORS

from bot import bot, process_update, drop_pending_updates

app = Flask(__name__)
CORS(app)

APP_URL = os.environ.get("APP_URL", "https://tma-cafe-backend.onrender.com")
WEBHOOK_PATH = os.environ.get("WEBHOOK_PATH", "bot")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", f"{APP_URL}/{WEBHOOK_PATH}")


# ---------- health ----------

@app.route("/health")
def health():
    return jsonify(status="ok")


# ---------- webhook ----------

@app.route(f"/{WEBHOOK_PATH}", methods=["POST"])
def webhook_route():
    json_update = request.get_json(force=True, silent=True)
    if not json_update:
        return jsonify(status="no json"), 400

    process_update(json_update)
    return jsonify(status="ok")


@app.route("/refresh_webhook")
def refresh_webhook_route():
    # 1. очистим старые апдейты
    drop_pending_updates()

    # 2. снимем старый вебхук и поставим новый
    try:
        bot.remove_webhook()
    except Exception:
        pass

    bot.set_webhook(
        url=WEBHOOK_URL,
        allowed_updates=["message", "pre_checkout_query", "successful_payment"],
    )

    return jsonify(message="webhook is alive")


# ---------- локальный запуск ----------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
