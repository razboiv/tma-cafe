# backend/app/main.py
import logging
import os

from flask import Flask, jsonify, request
from flask_cors import CORS

from app.bot import process_update, refresh_webhook

logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app)


# ---------- сервисные роуты ----------

@app.route("/health")
def health():
    return jsonify(status="ok")


@app.route("/")
def root():
    return jsonify(
        backend_url="",
        env=os.getenv("RENDER_ENV") or "production",
        version="mini-patch-2025-11-11",
    )


# ---------- Telegram webhook ----------

@app.route("/bot", methods=["POST"])
def bot_route():
    update_json = request.get_json(silent=True)
    if not update_json:
        return jsonify({"status": "ignored", "reason": "no json"}), 400

    process_update(update_json)
    return jsonify({"status": "ok"})


@app.route("/refresh_webhook")
def refresh_webhook_route():
    try:
        refresh_webhook()
        return jsonify({"status": "ok"})
    except Exception:
        logging.exception("ERROR: refresh_webhook failed")
        return jsonify({"message": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
