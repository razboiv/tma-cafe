import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from telebot.types import LabeledPrice

from app import auth, bot                         # наш модуль бота
from app.bot import process_update, refresh_webhook

@app.route("/refresh_webhook")
def refresh_webhook_route():
    refresh_webhook()
    return jsonify({"message": "webhook is alive"})

app = Flask(__name__)
app.url_map.strict_slashes = False
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})
logging.getLogger("werkzeug").setLevel(logging.INFO)

# ==== data paths ====
BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))        # .../backend
DATA_DIR    = os.path.join(BACKEND_DIR, "data")
MENU_DIR    = os.path.join(DATA_DIR, "menu")

def read_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ---- health ----
@app.get("/health")
def health():
    return jsonify({"status": "ok"})

# ---- info & categories ----
@app.get("/info")
def get_info():
    return jsonify(read_json(os.path.join(DATA_DIR, "info.json")))

@app.get("/categories")
def get_categories():
    return jsonify(read_json(os.path.join(DATA_DIR, "categories.json")))

# ---- menu ----
@app.get("/menu/<category_id>")
def get_menu(category_id: str):
    return jsonify(read_json(os.path.join(MENU_DIR, f"{category_id}.json")))

@app.get("/menu/details/<menu_item_id>")
def get_menu_item(menu_item_id: str):
    for fname in os.listdir(MENU_DIR):
        if not fname.endswith(".json"):
            continue
        items = read_json(os.path.join(MENU_DIR, fname))
        for it in items:
            if it.get("id") == menu_item_id:
                return jsonify(it)
    return jsonify({"message": f"item `{menu_item_id}` not found"}), 404

# ---- server-side Checkout: POST /order ----
@app.post("/order")
def create_order():
    """
    Body:
      {
        "_auth": "<Telegram.WebApp.initData>",
        "cartItems": [
          { "cafeItem": {...}, "variant": {"name":"...", "cost": 599}, "quantity": 1 },
          ...
        ]
      }
    """
    data = request.get_json(silent=True) or {}

    # 1) проверяем подпись initData — иначе 401
    init_data = data.get("_auth")
    if not init_data or not auth.validate_auth_data(bot.BOT_TOKEN, init_data):
        return jsonify({"message": "Request data should contain valid auth data."}), 401

    # 2) собираем цены
    order_items = data.get("cartItems") or []
    if not order_items:
        return jsonify({"message": "Cart items are not provided."}), 400

    prices = []
    for oi in order_items:
        name = oi["cafeItem"]["name"]
        variant = oi["variant"]["name"]
        cost = int(oi["variant"]["cost"])          # в центах
        qty  = int(oi["quantity"])
        prices.append(LabeledPrice(f"{name} ({variant}) x{qty}", cost * qty))

    # 3) создаём ссылку на инвойс
    invoice_url = bot.create_invoice_link(prices)
    return jsonify({"invoiceUrl": invoice_url})

# ---- Telegram webhook ----
@app.post("/bot")
def bot_webhook():
    raw = request.get_data(cache=False, as_text=True)
    app.logger.info("update: %s", raw)             # видно в логах Render
    process_update(raw)
    return jsonify({"ok": True})

@app.get("/refresh-webhook")
def refresh_webhook_route():
    info = refresh_webhook()
    return jsonify({"message": "Webhook refreshed", "info": info})

@app.get("/")
def root():
    return jsonify({"service": "tma-cafe-backend", "env": "prod"})

# ставим вебхук при старте
refresh_webhook()
