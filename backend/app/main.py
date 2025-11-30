# backend/app/main.py
from flask import Flask, request, jsonify

from .bot import process_update, refresh_webhook

app = Flask(__name__)


@app.get("/")
def index():
    return jsonify(
        {
            "backend_url": "",
            "env": "production",
            "version": "mini-patch-2025-11-11",
        }
    )


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/bot")
def bot_route():
    json_data = request.get_json(silent=True) or {}
    process_update(json_data)
    return jsonify({"status": "ok"})


@app.get("/refresh_webhook")
def refresh_webhook_route():
    refresh_webhook()
    return jsonify({"message": "webhook is alive"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
