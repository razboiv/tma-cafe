from flask import Flask, request, jsonify
import os

from app.bot import process_update, refresh_webhook

app = Flask(__name__)


@app.route("/", methods=["GET"])
def root():
    return jsonify({"status": "ok"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"message": "webhook is alive"})


@app.route("/refresh_webhook", methods=["GET"])
def refresh():
    refresh_webhook()
    return jsonify({"status": "webhook refreshed"})


@app.route("/bot", methods=["POST"])
def telegram_webhook():
    data = request.get_json(force=True)
    process_update(data)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
