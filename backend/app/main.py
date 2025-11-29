# backend/app/main.py

from flask import Flask, request, jsonify
from bot import process_update, refresh_webhook

app = Flask(__name__)


@app.route("/")
def home():
    return jsonify({"status": "ok"})


@app.route("/health")
def health():
    return jsonify({"message": "webhook is alive"})


@app.route("/refresh_webhook")
def set_hook():
    refresh_webhook()
    return jsonify({"status": "webhook refreshed"})


@app.route("/bot", methods=["POST"])
def receive_update():
    json_data = request.get_json(force=True, silent=True)

    if not json_data:
        return jsonify({"error": "empty update"}), 400

    process_update(json_data)
    return jsonify({"ok": True})


# Run local (Render ignores this)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
