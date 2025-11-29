# backend/main.py
import os
from flask import Flask, request, jsonify
from bot import process_update, refresh_webhook

app = Flask(__name__)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "message": "backend is running",
        "env": "production",
    })

@app.route("/refresh_webhook", methods=["GET"])
def refresh():
    refresh_webhook()
    return jsonify({"message": "webhook refreshed"})

@app.route("/bot", methods=["POST", "GET"])
def bot_webhook():
    if request.method == "GET":
        return jsonify({"message": "webhook is alive"})

    update = request.get_json(force=True, silent=True)
    if not update:
        return jsonify({"error": "empty update"})

    process_update(update)
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
