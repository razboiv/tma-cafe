# backend/app/main.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import os

from app.bot import process_update, refresh_webhook, enable_debug_logging

app = Flask(__name__)
CORS(app)

enable_debug_logging()


@app.get("/")
def root():
    return jsonify({
        "backend_url": "",
        "env": "production",
        "version": "mini-patch"
    })


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/refresh_webhook")
def refresh():
    refresh_webhook()
    return jsonify({"status": "webhook refreshed"})


@app.post("/bot")
def bot_webhook():
    update_json = request.get_json(force=True, silent=True)
    if not update_json:
        return jsonify({"ok": False}), 400

    process_update(update_json)
    return jsonify({"ok": True})


@app.get("/bot")
def bot_test():
    return jsonify({"message": "webhook alive"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
