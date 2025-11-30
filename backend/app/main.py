# backend/app/main.py
import json
import logging
import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

from .bot import process_update, refresh_webhook, enable_debug_logging

# ---------- базовые настройки ----------
logging.basicConfig(level=logging.INFO)

ENV = os.getenv("ENV", "production")

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = BASE_DIR / "data" / "menu"

INFO_PATH = DATA_DIR / "info.json"
CATEGORIES_PATH = DATA_DIR / "categories.json"

# ---------- Flask ----------
app = Flask(__name__)
CORS(app, origins=os.getenv("CORS_ORIGINS", "*"))

enable_debug_logging()


# ---------- helpers ----------
def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


# ---------- routes ----------
@app.route("/")
def index():
    return jsonify(
        {
            "backend_url": "",
            "env": ENV,
            "version": "mini-patch-2025-11-11",
        }
    )


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/info")
def info():
    return jsonify(load_json(INFO_PATH))


@app.route("/categories")
def categories():
    data = load_json(CATEGORIES_PATH)
    return jsonify(data.get("categories", []))


@app.route("/menu/popular")
def popular_menu():
    data = load_json(CATEGORIES_PATH)
    return jsonify(data.get("popular", []))


@app.route("/menu/details/<slug>")
def menu_details(slug: str):
    data = load_json(CATEGORIES_PATH)
    items = data.get("items", {})
    item = items.get(slug)
    if not item:
        return jsonify({"error": "Not found"}), 404
    return jsonify(item)


# ---------- Telegram webhook ----------
@app.route("/bot", methods=["POST"])
def bot_webhook():
    json_data = request.get_json(force=True, silent=True) or {}
    logging.info("[FLASK] /bot got update: %s", json_data)
    process_update(json_data)
    return jsonify({"status": "ok"})


@app.route("/refresh_webhook")
def refresh_webhook_route():
    try:
        url = refresh_webhook()
        logging.info("Webhook set to %s", url)
        return jsonify({"status": "ok", "webhook": url})
    except Exception as e:  # noqa: BLE001
        logging.exception("Failed to refresh webhook: %s", e)
        return jsonify({"message": "Internal server error"}), 500


# ---------- entrypoint ----------
if __name__ == "__main__":
    # локальный запуск
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
