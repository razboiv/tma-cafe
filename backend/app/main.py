# backend/app/main.py
import os
import json

from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from telebot.types import LabeledPrice

from . import auth, bot  # наши модули рядом

# =========================
# Загрузка переменных .env
# =========================
load_dotenv()

app = Flask(__name__)
# чтобы '/bot' и '/bot/' считались одним и тем же путём
app.url_map.strict_slashes = False

# =========================
# CORS (разрешаем фронту/Telegram)
# =========================
APP_URL = os.getenv("APP_URL")
DEV_APP_URL = os.getenv("DEV_APP_URL")

allowed_origins = [o for o in [
    APP_URL,
    DEV_APP_URL,
    "https://t.me",
    "https://web.telegram.org",
    "https://web.telegram.org/a",
] if o]

CORS(
    app,
    resources=r"/.*",
    origins=allowed_origins or "*",
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=False,
)

# Health/debug
@app.route("/", methods=["GET"])
def root_ok():
    return jsonify({"ok": True}), 200


# =========================
# Telegram Webhook (POST)
# =========================
@app.route(bot.WEBHOOK_PATH, methods=["POST"])
@app.route(f"/{bot.WEBHOOK_PATH}", methods=["POST"])
def bot_webhook():
    """Точка входа для апдейтов Telegram."""
    update = request.get_json(force=True, silent=True)
    bot.process_update(update)
    return jsonify({"message": "OK"}), 200


# =========================
# Public API for Mini App
# =========================
def json_data(file_path: str):
    """Считываем JSON из файла (UTF-8) и отдаём как dict/list."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.route("/info")
def info():
    try:
        return json_data("data/info.json")
    except FileNotFoundError:
        return jsonify({"message": "Info file not found"}), 404
    except Exception as e:
        return jsonify({"message": f"Unexpected error: {e}"}), 500

@app.route("/categories")
def categories():
    try:
        return json_data("data/categories.json")
    except FileNotFoundError:
        return jsonify({"message": "Categories file not found"}), 404
    except Exception as e:
        return jsonify({"message": f"Unexpected error: {e}"}), 500

@app.route("/menu/<category_id>")
def category_menu(category_id: str):
    try:
        return json_data(f"data/menu/{category_id}.json")
    except FileNotFoundError:
        return jsonify({"message": f"No menu found for {category_id}"}), 404
    except Exception as e:
        return jsonify({"message": f"Unexpected error: {e}"}), 500

@app.route("/menu/details/<menu_item_id>")
def menu_item_details(menu_item_id: str):
    try:
        data_folder_path = "data/menu"
        for data_file in os.listdir(data_folder_path):
            if not data_file.endswith(".json"):
                continue
            menu_items = json_data(f"{data_folder_path}/{data_file}")
            found = next((m for m in menu_items if m.get("id") == menu_item_id), None)
            if found:
                return found
        return jsonify({"message": f"Item {menu_item_id} not found"}), 404
    except FileNotFoundError:
        return jsonify({"message": "Menu data not found"}), 404
    except Exception as e:
        return jsonify({"message": f"Unexpected error: {e}"}), 500


# =========================
# /order — создание инвойса (Telegram Payments)
# =========================
@app.route("/order", methods=["POST"])
def create_order():
    """
    Принимаем telegram'ное initData + корзину и создаём ссылку-инвойс через Telegram Payments.
    Возвращаем { ok: true, invoiceUrl } чтобы Mini App открыл платёж.
    """
    # 0) Берём JSON из тела; если пришёл как строка — пробуем распарсить.
    payload = request.get_json(silent=True)
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = None

    if not isinstance(payload, dict):
        return jsonify({"message": "Bad request body: not JSON/dict"}), 400

    # 1) проверяем initData
    auth_data = payload.get("_auth")
    if not auth_data:
        return jsonify({"message": "Invalid auth data"}), 401
    if not auth.validate_auth_data(bot.BOT_TOKEN, auth_data):
        return jsonify({"message": "Auth validation failed"}), 401

    # 2) проверяем корзину
    cart_items = payload.get("cartItems")
    if not isinstance(cart_items, list) or len(cart_items) == 0:
        return jsonify({"message": "Cart is empty"}), 400

    labeled_prices = []
    total_kopecks = 0

    # 3) валидируем каждую позицию
    for idx, item in enumerate(cart_items, start=1):
        if not isinstance(item, dict):
            return jsonify({"message": f"Bad cart item format at #{idx}"}), 400

        cafe = item.get("cafeteria") or {}
        variant = item.get("variant") or {}
        quantity = item.get("quantity")

        name = (cafe or {}).get("name")
        var_name = (variant or {}).get("name")
        cost = (variant or {}).get("cost")

        if name is None or var_name is None or quantity is None or cost is None:
            return jsonify({"message": f"Bad cart item format at #{idx}"}), 400

        try:
            quantity = int(quantity)
            cost_kopecks = int(cost)  # 1199 -> 1199 копеек (т.е. 11.99)
        except Exception:
            return jsonify({"message": f"Bad number in item #{idx}"}), 400

        amount = cost_kopecks * quantity
        total_kopecks += amount

        labeled_prices.append(
            LabeledPrice(
                label=f"{name} ({var_name}) x{quantity}",
                amount=amount
            )
        )

    # 4) токен платёжного провайдера
    provider_token = os.getenv("PAYMENT_PROVIDER_TOKEN")
    if not provider_token:
        return jsonify({"message": "PAYMENT_PROVIDER_TOKEN not set"}), 500

    payload_str = f"order-{total_kopecks}"

    # 5) создаём ссылку на инвойс
    invoice_url = bot.create_invoice_link(
        title="Заказ в магазине",
        description="Оплата корзины в MiniApp",
        payload=payload_str,
        provider_token=provider_token,
        currency="RUB",
        prices=labeled_prices,
        # need_* при надобности:
        # need_name=True, need_phone_number=True, need_shipping_address=True
    )

    return jsonify({"ok": True, "invoiceUrl": invoice_url}), 200


# =========================
# Health для аптайм-роботов
# =========================
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# На старте обновляем вебхук (как в шаблоне)
bot.refresh_webhook()
