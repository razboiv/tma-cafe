# backend/app/main.py
import os
import json

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from telebot.types import LabeledPrice

from . import auth, bot

# ================================
# env
# ================================
load_dotenv()

app = Flask(__name__)
# чтобы /bot и /bot/ считались одним путём
app.url_map.strict_slashes = False

# ================================
# CORS
# ================================
APP_URL = os.getenv("APP_URL")
DEV_APP_URL = os.getenv("DEV_APP_URL")

allowed_origins = [o for o in [
    APP_URL,
    DEV_APP_URL,
    "https://t.me",
    "https://web.telegram.org",
    "https://telegram.org",
] if o]

CORS(
    app,
    resources={r"/**": {
        "origins": allowed_origins or "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    }}
)

# ================================
# health
# ================================
@app.route("/", methods=["GET"])
def root_ok():
    return {"ok": True}, 200

# ================================
# Telegram webhook (POST)
# ================================
@app.route(bot.WEBHOOK_PATH, methods=["POST"])
@app.route(f"/{bot.WEBHOOK_PATH}", methods=["POST"])
def bot_webhook():
    update = request.get_json(force=True, silent=True)
    bot.process_update(update)
    return {"message": "OK"}, 200

# ================================
# Public API for Mini App
# ================================
def json_data(file_path: str):
    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.route("/info")
def info():
    try:
        return json_data("data/info.json")
    except FileNotFoundError:
        return {"message": "Info file not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500

@app.route("/categories")
def categories():
    try:
        return json_data("data/categories.json")
    except FileNotFoundError:
        return {"message": "Categories file not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500

@app.route("/menu/<category_id>")
def category_menu(category_id: str):
    try:
        return json_data(f"data/menu/{category_id}.json")
    except FileNotFoundError:
        return {"message": f"No menu found for {category_id}"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500

@app.route("/menu/details/<menu_item_id>")
def menu_item_details(menu_item_id: str):
    try:
        folder = "data/menu"
        for file in os.listdir(folder):
            if not file.endswith(".json"):
                continue
            items = json_data(os.path.join(folder, file))
            found = next((m for m in items if m.get("id") == menu_item_id), None)
            if found:
                return found
        return {"message": f"Item {menu_item_id} not found"}, 404
    except FileNotFoundError:
        return {"message": "Menu data not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500

# ================================
# /order — создание инвойса
# ================================
@app.route("/order", methods=["POST"])
def create_order():
    """
    Принимаем initData + корзину и создаём ссылку-инвойс через Telegram Payments.
    Возвращаем { ok: true, invoiceUrl }.
    """

    # 1) Безопасно разбираем JSON (иногда Flask даёт строку)
    body = request.get_data(cache=False, as_text=True) or ""
    try:
        request_data = request.get_json(silent=True)
        if isinstance(request_data, str):
            request_data = json.loads(request_data)
        if request_data is None:
            request_data = json.loads(body) if body.strip() else {}
    except Exception:
        return {"message": "Invalid JSON"}, 400

    # 2) Проверяем initData (auth)
    auth_data = request_data.get("_auth")
    if not auth_data or not auth.validate_auth_data(bot.BOT_TOKEN, auth_data):
        return {"message": "Invalid auth data"}, 401

    # 3) Проверяем корзину
    order_items = request_data.get("cartItems")
    if not isinstance(order_items, list) or len(order_items) == 0:
        return {"message": "Cart is empty"}, 400

    # Формируем позиции
    labeled_prices: list[LabeledPrice] = []
    total_minor = 0  # сумма в минимальных единицах (центах)

    try:
        for item in order_items:
            # ожидаем: { cafeteria: {name}, variant: {name, cost}, quantity }
            cafeteria = item.get("cafeteria") or {}
            variant = item.get("variant") or {}
            quantity = int(item.get("quantity") or 0)

            name = str(cafeteria.get("name") or "").strip()
            variant_name = str(variant.get("name") or "").strip()
            cost_cents = int(variant.get("cost"))  # уже в центах (пример: 1199)

            if not name or not variant_name or quantity <= 0:
                return {"message": "Bad cart item format"}, 400

            amount = cost_cents * quantity  # уже минимальные единицы
            total_minor += amount

            labeled_prices.append(
                LabeledPrice(
                    label=f"{name} ({variant_name}) x{quantity}",
                    amount=amount
                )
            )
    except Exception:
        return {"message": "Bad cart item format"}, 400

    # 4) Токен провайдера
    provider_token = os.getenv("PAYMENT_PROVIDER_TOKEN")
    if not provider_token:
        return {"message": "PAYMENT_PROVIDER_TOKEN not set"}, 500

    # 5) Собираем инвойс
    payload = f"order-{total_minor}"
    try:
        invoice_url = bot.create_invoice_link(
            title="Order #1",
            description="Оплата корзины в MiniApp",
            payload=payload,
            provider_token=provider_token,
            currency="USD",          # цены в проекте в центах USD
            prices=labeled_prices,
            # при необходимости:
            # need_name=True, need_phone_number=True, need_shipping_address=True
        )
    except Exception as e:
        # вернём понятную ошибку, чтобы видеть корень в сети
        return {"message": f"Failed to create invoice: {e}"}, 500

    return {"ok": True, "invoiceUrl": invoice_url}, 200


# UptimeRobot /health
@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200


# сброс вебхука при старте (как и в шаблоне)
bot.refresh_webhook()
