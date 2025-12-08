# backend/app/main.py
import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from telebot.types import LabeledPrice  # импорт оставляем, чтобы зависимости были
from app.bot import process_update, refresh_webhook

# ---------- Flask + CORS ----------
app = Flask(__name__)

cors_origins_env = os.getenv("CORS_ORIGINS", "*")
if cors_origins_env and cors_origins_env != "*":
    origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    origins = ["*"]
CORS(app, resources={r"/*": {"origins": origins}})

# ---------- утилита для чтения JSON из backend/data ----------
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_json(rel_path: str):
    path = os.path.join(DATA_DIR, rel_path)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ---------- health / root ----------
@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200

@app.get("/")
def root():
    return jsonify({"service": "tma-cafe-backend", "env": "prod"}), 200

# ---------- публичные API ----------
@app.get("/info")
def get_info():
    return jsonify(load_json("info.json")), 200

@app.get("/categories")
def get_categories():
    return jsonify(load_json("categories.json")), 200

@app.get("/menu/popular")
def get_popular():
    return jsonify(load_json("menu/popular.json")), 200

@app.get("/menu/details/<string:slug>")
def get_menu_details(slug: str):
    try:
        return jsonify(load_json(f"menu/{slug}.json")), 200
    except FileNotFoundError:
        return jsonify({"error": "not found", "slug": slug}), 404

# ---------- Telegram webhook ----------
WEBHOOK_PATH = "/" + os.getenv("WEBHOOK_PATH", "bot").lstrip("/")

@app.post(WEBHOOK_PATH)
def telegram_webhook():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}
    process_update(payload)
    return jsonify({"ok": True})

# ручное обновление вебхука (удобно для проверки)
@app.get("/refresh_webhook")
def refresh_webhook_route():
    info = refresh_webhook()
    return jsonify({"message": "webhook is alive", "info": info}), 200

# при старте можно попытаться поставить вебхук (не критично, если не выйдет)
if os.getenv("AUTO_SET_WEBHOOK", "1") == "1":
    try:
        refresh_webhook()
    except Exception as e:
        logging.getLogger(__name__).warning("Webhook setup on start failed: %s", e)

# локальный запуск
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8080")))