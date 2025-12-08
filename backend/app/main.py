# backend/app/main.py
import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from app.bot import process_update, refresh_webhook

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Абсолютные пути к данным
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR    = os.path.join(BACKEND_DIR, "data")
MENU_DIR    = os.path.join(DATA_DIR, "menu")

def load_json_from_data(rel_path: str):
    """Читает JSON из backend/data/<rel_path>."""
    path = os.path.join(DATA_DIR, rel_path)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ---------- health & root ----------
@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200

@app.get("/")
def root():
    return jsonify({"service": "tma-cafe-backend", "env": "prod"}), 200

# ---------- публичные API ----------
@app.get("/info")
def get_info():
    return jsonify(load_json_from_data("info.json")), 200

@app.get("/categories")
def get_categories():
    return jsonify(load_json_from_data("categories.json")), 200

@app.get("/menu/popular")
def get_popular():
    return jsonify(load_json_from_data("menu/popular.json")), 200

# меню по категории: /menu/<slug> -> backend/data/menu/<slug>.json
@app.get("/menu/<string:category_slug>")
def get_menu_category(category_slug: str):
    try:
        return jsonify(load_json_from_data(f"menu/{category_slug}.json")), 200
    except FileNotFoundError:
        return jsonify({"error": "category not found", "slug": category_slug}), 404

# детали блюда по ID: ищем item по id во всех файлах backend/data/menu/*.json
@app.get("/menu/details/<string:item_id>")
def get_menu_item(item_id: str):
    try:
        for fname in os.listdir(MENU_DIR):
            if not fname.endswith(".json"):
                continue
            items = load_json_from_data(f"menu/{fname}")
            found = next((x for x in items if str(x.get("id")) == item_id), None)
            if found:
                return jsonify(found), 200
        return jsonify({"error": "item not found", "id": item_id}), 404
    except FileNotFoundError:
        return jsonify({"error": "item not found", "id": item_id}), 404

# ---------- Telegram webhook ----------
WEBHOOK_PATH = "/" + os.getenv("WEBHOOK_PATH", "bot").lstrip("/")

@app.post(WEBHOOK_PATH)
def telegram_webhook():
    update = request.get_json(silent=True) or {}
    process_update(update)
    return jsonify({"ok": True})

@app.get("/refresh_webhook")
def refresh_webhook_route():
    info = refresh_webhook()
    return jsonify({"message": "webhook is alive", "info": info}), 200

# (не обязательно) попытаться поставить вебхук при старте
if os.getenv("AUTO_SET_WEBHOOK", "1") == "1":
    try:
        refresh_webhook()
    except Exception as e:
        logger.warning("Webhook setup on start failed: %s", e)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))