# backend/app/main.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = app.logger

@app.get("/")
def root():
    # Render дергает корень для health-check — отдаём 200
    return "ok true", 200

@app.get("/ok")
def ok():
    return jsonify({"ok": True}), 200

@app.get("/info")
def info():
    return jsonify({
        "env": os.getenv("NODE_ENV", ""),
        "backend_url": os.getenv("BACKEND_URL", ""),
        "version": "mini-patch-2025-11-11"
    }), 200

@app.post("/order")
def order():
    data = request.get_json(silent=True, force=True) or {}
    logger.info("ORDER payload: %s", data)

    # Базовая валидация — как в твоём фронте: нужны _auth и cartItems
    if not data.get("_auth") or not data.get("cartItems"):
        return jsonify({"ok": False, "error": "BAD_PAYLOAD"}), 400

    # Здесь позже можно вставить проверку Telegram initData (auth),
    # создание инвойса и т.д. Пока отвечаем OK, чтобы фронт не падал.
    return jsonify({"ok": True}), 200

@app.post("/bot")
def bot_webhook():
    # Заглушка, чтобы POST /bot не отдавал 405
    return "ok", 200

if __name__ == "__main__":
    # Локальный запуск; в Render запустит gunicorn
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
