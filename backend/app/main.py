# backend/app/main.py
from flask import Flask, request, jsonify
from bot import process_update, refresh_webhook   # ← работает, потому что bot.py лежит рядом

app = Flask(__name__)


# ---------- health ----------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ---------- webhook test ----------
@app.route("/", methods=["GET"])
def root():
    return jsonify({"message": "webhook is alive"}), 200


# ---------- обновление webhook ----------
@app.route("/refresh_webhook", methods=["GET"])
def refresh():
    refresh_webhook()
    return jsonify({"status": "refreshed"}), 200


# ---------- Telegram webhook endpoint ----------
@app.route("/bot", methods=["POST"])
def bot_webhook():
    try:
        update_json = request.get_json(force=True, silent=True)
        if update_json:
            process_update(update_json)
        return jsonify({"ok": True})
    except Exception as e:
        print("Webhook error:", e)
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
