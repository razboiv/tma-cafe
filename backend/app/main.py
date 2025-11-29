import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Импортируем bot.py из той же директории
from bot import process_update, refresh_webhook

app = Flask(__name__)

# ---------------- health-check ----------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ---------------- webhook test ----------------
@app.route("/webhook", methods=["GET"])
def webhook_test():
    return jsonify({"message": "webhook is alive"}), 200


# ---------------- refresh webhook ----------------
@app.route("/refresh_webhook", methods=["GET"])
def refresh_hook():
    refresh_webhook()
    return jsonify({"status": "webhook updated"}), 200


# ---------------- receive updates from Telegram ----------------
@app.route("/bot", methods=["POST"])
def bot_webhook():
    try:
        update_json = request.get_json(force=True, silent=True)
        if not update_json:
            return jsonify({"error": "No JSON received"}), 400

        process_update(update_json)
        return jsonify({"status": "ok"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- start server ----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
