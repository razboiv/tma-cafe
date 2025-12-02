import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

from app.bot import process_update, refresh_webhook

app = Flask(__name__)
app.url_map.strict_slashes = False
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

# --- data paths ---
BASE_DIR = os.path.dirname(os.path.dirname(__file__))   # .../backend
DATA_DIR = os.path.join(BASE_DIR, "data")
MENU_DIR = os.path.join(DATA_DIR, "menu")

def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/health")
def health():
    return jsonify({"status": "ok"})

@app.get("/info")
def get_info():
    return jsonify(read_json(os.path.join(DATA_DIR, "info.json")))

@app.get("/categories")
def get_categories():
    return jsonify(read_json(os.path.join(DATA_DIR, "categories.json")))

@app.get("/menu/<category_id>")
def get_menu(category_id):
    return jsonify(read_json(os.path.join(MENU_DIR, f"{category_id}.json")))

@app.get("/menu/details/<menu_item_id>")
def get_menu_item(menu_item_id):
    for name in os.listdir(MENU_DIR):
        if not name.endswith(".json"):
            continue
        items = read_json(os.path.join(MENU_DIR, name))
        for it in items:
            if it.get("id") == menu_item_id:
                return jsonify(it)
    return jsonify({"message": f"item {menu_item_id} not found"}), 404

# ---- Telegram webhook ----
@app.post("/bot")
def bot_webhook():
    raw = request.get_data(cache=False, as_text=True)  # сырое тело (для логов)
    app.logger.info("update: %s", raw)
    process_update(raw)  # передаём строку; дальше распарсим в bot.py
    return jsonify({"ok": True})

@app.get("/refresh-webhook")
def refresh_webhook_route():
    info = refresh_webhook()
    return jsonify({"message": "Webhook refreshed", "info": info})

@app.get("/")
def root():
    return jsonify({"service": "tma-cafe-backend", "env": "prod"})

# Ставим вебхук при старте
refresh_webhook()
