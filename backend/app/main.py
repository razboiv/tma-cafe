import os
import json
import logging

from flask import Flask, jsonify, request
from flask_cors import CORS

from app.bot import process_update, refresh_webhook, enable_debug_logging


# ---------------- базовая настройка Flask ----------------

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Включаем подробные логи TeleBot (видно в Render-логах)
enable_debug_logging()

# --------- пути к JSON-файлам (ИМЕННО абсолютные!) ---------

# backend/
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# backend/data/menu/
MENU_DIR = os.path.join(BACKEND_DIR, "data", "menu")


def load_json(filename: str):
    """Читаем JSON из backend/data/menu/<filename>."""
    path = os.path.join(MENU_DIR, filename)
    logger.info("Loading JSON: %s", path)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------- health ----------------------------

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ---------------------- info ------------------------------

@app.route("/info")
def get_info():
    data = load_json("info.json")
    return jsonify(data)


# ------------------- категории ---------------------------

@app.route("/categories")
def get_categories():
    data = load_json("categories.json")
    return jsonify(data)


# ------------------- популярное меню ---------------------

@app.route("/menu/popular")
def get_popular_menu():
    """
    Если у тебя отдельный JSON для популярного —
    просто поменяй имя файла тут.
    """
    data = load_json("popular.json")  # при необходимости переименуй файл
    return jsonify(data)


# ------------- детали блюда по slug ----------------------

@app.route("/menu/details/<slug>")
def get_menu_item(slug: str):
    """
    Ожидает файл backend/data/menu/<slug>.json
    Например: burger-1.json
    """
    filename = f"{slug}.json"
    try:
        data = load_json(filename)
    except FileNotFoundError:
        return jsonify({"error": "Item not found"}), 404
    return jsonify(data)


# ----------------- Telegram webhook ----------------------

@app.route("/bot", methods=["POST"])
def bot_webhook():
    """
    Сюда Telegram шлёт апдейты.
    """
    update_json = request.get_json(silent=True, force=True) or {}
    logger.info("Got update from Telegram: %s", update_json)
    process_update(update_json)
    return jsonify({"status": "ok"})


@app.route("/refresh_webhook")
def refresh_webhook_route():
    """
    Ручка, которую ты открываешь в браузере,
    чтобы пересоздать webhook.
    """
    logger.info("Refreshing webhook…")
    refresh_webhook()
    return jsonify({"message": "webhook is alive"})


# ---------------------- root -----------------------------

@app.route("/")
def root():
    return jsonify(
        {
            "backend_url": "",
            "env": "production",
            "version": "mini-patch-2025-11-11",
        }
    )


# ---------------- локальный запуск -----------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
