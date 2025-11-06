# backend/app/main.py

import os
import json

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from telebot.types import LabeledPrice

# наши модули рядом
from . import auth, bot

# ================================
#  Загрузка переменных .env
# ================================
load_dotenv()

app = Flask(__name__)
# чтобы /bot и /bot/ считались одним и тем же путём (без 307/404)
app.url_map.strict_slashes = False

# ================================
#  CORS (разрешаем фронту/Telegram)
# ================================
APP_URL = os.getenv("APP_URL")          # прод-URL фронта (например, https://luvcore.shop)
DEV_APP_URL = os.getenv("DEV_APP_URL")  # опционально для локалки

allowed_origins = [o for o in [
    APP_URL,
    DEV_APP_URL,
    "https://t.me",
    "https://web.telegram.org",
    "https://telegram.org",
] if o]

CORS(
    app,
    resources={r"/*": {
        "origins": allowed_origins or "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False,
    }}
)

# ================================
#  Health / Debug
# ================================
@app.route("/", methods=["GET"])
def root_ok():
    return {"ok": True}, 200


# ================================
#  Telegram Webhook (POST)
#  Важно: держим оба варианта пути, чтобы не ловить 307/404
# ================================
@app.route(bot.WEBHOOK_PATH, methods=["POST"])
@app.route(f"/{bot.WEBHOOK_PATH}", methods=["POST"])
def bot_webhook():
    """
    Точка входа для апдейтов Telegram.
    """
    update = request.get_json(force=True, silent=True)
    bot.process_update(update)
    return {"message": "OK"}, 200


# ================================
#  Public API for Mini App
# ================================
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
    """
    Ищем элемент меню по id в папке data/menu/*.json
    """
    try:
        data_folder_path = "data/menu"
        for data_file in os.listdir(data_folder_path):
            if not data_file.endswith(".json"):
                continue
            menu_items = json_data(f"{data_folder_path}/{data_file}")
            desired = next((m for m in menu_items if m.get("id") == menu_item_id), None)
            if desired:
                return desired
        return {"message": f"Item {menu_item_id} not found"}, 404
    except FileNotFoundError:
        return {"message": "Menu data not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


# ================================
#  /order — создание инвойса (Telegram Payments)
# ================================
@app.route("/order", methods=["POST"])
def create_order():
    """
    Принимаем telegram'ное initData + корзину и создаём ссылку-инвойс
    через Telegram Payments (провайдер — твой в BotFather).
    Возвращаем invoiceUrl, чтобы Mini App открыл платёж.
    """
    req = request.get_json(force=True, silent=True) or {}

    # 1) проверяем initData
    auth_data = req.get("_auth")
    if not auth_data or not auth.validate_auth_data(bot.BOT_TOKEN, auth_data):
        return {"message": "Invalid auth data"}, 401

    # 2) проверяем корзину
    order_items = req.get("cartItems")
    if not order_items:
        return {"message": "Cart is empty"}, 400

    labeled_prices: list[LabeledPrice] = []
    total_kopecks = 0

    # Приводим товары к позициям для Telegram Payments
    # ВНИМАНИЕ: фронт отправляет поле cafeItem (а не cafeteria)
    for item in order_items:
        cafe = item["cafeItem"]
        variant = item["variant"]
        quantity = int(item["quantity"])

        name = cafe["name"]
        variant_name = variant["name"]
        cost_rub = int(variant["cost"])

        amount = cost_rub * quantity * 100  # Telegram принимает сумму в копейках
        total_kopecks += amount

        labeled_prices.append(
            LabeledPrice(
                label=f"{name} ({variant_name}) ×{quantity}",
                amount=amount
            )
        )

    # 3) токен платёжного провайдера
    provider_token = os.getenv("PAYMENT_PROVIDER_TOKEN")
    if not provider_token:
        return {"message": "PAYMENT_PROVIDER_TOKEN not set"}, 500

    # полезная нагрузка — сюда можете подставлять свой order_id
    payload = f"order-{total_kopecks}"

    # создаём ссылку на инвойс
    invoice_url = bot.create_invoice_link(
        title="Заказ в магазине",
        description="Оплата корзины в MiniApp",
        payload=payload,
        provider_token=provider_token,
        currency="RUB",
        prices=labeled_prices,
        # need_name=True, need_phone_number=True, need_shipping_address=True  # при необходимости
    )

    return {"ok": True, "invoiceUrl": invoice_url}, 200


# ================================
#  Helpers
# ================================
def json_data(file_path: str):
    """
    Считываем JSON из файла (UTF-8) и отдаём как dict/list.
    """
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    raise FileNotFoundError(file_path)


# Health-check endpoint для UptimeRobot / Render
@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200


# Обновляем вебхук при старте
bot.refresh_webhook()
