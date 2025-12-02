import json
import logging
import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

from .bot import process_update, refresh_webhook

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"

app = Flask(__name__)
CORS(app, origins=os.getenv("CORS_ORIGINS", "*"))


# ---------- health / технические ----------

@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/")
def root():
    # просто чтобы корень не давал 404
    return jsonify({"backend_url": "", "env": "production"})


@app.get("/refresh_webhook")
def refresh_webhook_route():
    try:
        result = refresh_webhook()
        status = 200 if result.get("status") == "ok" else 500
        return jsonify(result), status
    except Exception as e:
        logger.exception("refresh_webhook failed: %s", e)
        return jsonify({"status": "error", "description": str(e)}), 500


# ---------- Telegram webhook ----------

@app.post("/bot")
def bot_webhook():
    try:
        json_data = request.get_data().decode("utf-8")
        process_update(json_data)
        return "OK", 200
    except Exception as e:
        logger.exception("Error on /bot: %s", e)
        return "ERROR", 500


# ---------- API для WebApp ----------

def _load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


@app.get("/categories")
def get_categories():
    data = _load_json(DATA_DIR / "menu" / "categories.json")
    return jsonify(data)


@app.get("/info")
def get_info():
    data = _load_json(DATA_DIR / "info.json")
    return jsonify(data)


@app.get("/menu/popular")
def get_popular_menu():
    data = _load_json(DATA_DIR / "menu" / "popular.json")
    return jsonify(data)


@app.get("/menu/details/<slug>")
def get_menu_item(slug):
    path = DATA_DIR / "menu" / "details" / f"{slug}.json"
    if not path.exists():
        return jsonify({"message": "Not found"}), 404
    data = _load_json(path)
    return jsonify(data)


# ---------- точка входа для локального запуска ----------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
