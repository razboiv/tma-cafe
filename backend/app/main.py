# backend/app/main.py
import os
import sys
import json
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from telebot.types import LabeledPrice

# ──────────────────────────────────────────────────────────────────────────────
# Пути/импорты: файл находится в backend/app/, а auth.py и bot.py — в backend/
# Добавляем backend/ в PYTHONPATH, чтобы работал import auth / import bot.
BASE_DIR = Path(__file__).resolve().parent.parent   # -> backend/
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

import auth  # backend/auth.py
import bot   # backend/bot.py
# ──────────────────────────────────────────────────────────────────────────────

load_dotenv()

app = Flask(__name__)
app.url_map.strict_slashes = False  # /order и /order/ считаем одним путём

# ──────────────────────────────────────────────────────────────────────────────
# CORS
APP_URL = os.getenv("APP_URL")
DEV_APP_URL = os.getenv("DEV_APP_URL")

allowed_origins = [
    o for o in [
        APP_URL,
        DEV_APP_URL,
        "https://t.me",
        "https://web.telegram.org",
        "https://telegram.org",
    ] if o
]

CORS(
    app,
    resources={r"/**": {
        "origins": allowed_origins or "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    }},
)
# ──────────────────────────────────────────────────────────────────────────────


# Health / debug
@app.get("/")
def root_ok():
    return {"ok": True}, 200


# Telegram webhook (держим оба варианта пути — без / со слэшем в начале)
@app.post(getattr(bot, "WEBHOOK_PATH", "/webhook"))
@app.post(f"/{getattr(bot, 'WEBHOOK_PATH', 'webhook').lstrip('/')}")
def bot_webhook():
    update = request.get_json(force=True, silent=True) or {}
    bot.process_update(update)
    return {"message": "OK"}, 200


# ──────────────────────────────────────────────────────────────────────────────
# Public API для Mini App
DATA_DIR = BASE_DIR / "data"  # backend/data/


def json_data(file_path: Path):
    if not file_path.exists():
        raise FileNotFoundError(str(file_path))
    with file_path.open("r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/info")
def info():
    try:
        return json_data(DATA_DIR / "info.json"), 200
    except FileNotFoundError:
        return {"message": "Info file not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


@app.get("/categories")
def categories():
    try:
        return json_data(DATA_DIR / "categories.json"), 200
    except FileNotFoundError:
        return {"message": "categories file not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


@app.get("/menu/<category_id>")
def category_menu(category_id: str):
    try:
        return json_data(DATA_DIR / f"{category_id}.json"), 200
    except FileNotFoundError:
        return {"message": f"No menu found for {category_id}"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


@app.get("/menu/details/<menu_item_id>")
def menu_item_details(menu_item_id: str):
    """
    Ищем элемент меню по id по всем *.json в папке data/menu
    """
    try:
        menu_folder = DATA_DIR / "menu"
        for data_file in sorted(menu_folder.glob("*.json")):
            items = json_data(data_file)
            found = next((m for m in items if m.get("id") == menu_item_id), None)
            if found:
                return found, 200
        return {"message": f"Item {menu_item_id} not found"}, 404
    except FileNotFoundError:
        return {"message": "Menu data not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


# ──────────────────────────────────────────────────────────────────────────────
# /order — создание инвойса (Telegram Payments)
@app.post("/order")
def create_order():
    """
    Принимаем initData и cartItems, валидируем initData,
    конвертируем корзину в labeled prices и создаём ссылку-инвойс.
    """
    # Вытаскиваем JSON
    payload = request.get_json(force=True, silent=True)
    if not isinstance(payload, dict):
        return {"message": "Request must be a JSON object"}, 400

    # 1) Проверяем initData
    auth_data = payload.get("_auth")
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token or not auth_data or not auth.validate_auth_data(bot_token, auth_data):
        return {"message": "Invalid auth data"}, 401

    # 2) Проверяем корзину
    order_items = payload.get("cartItems")
    if not isinstance(order_items, list) or not order_items:
        return {"message": "Cart is empty"}, 400

    labeled_prices: list[LabeledPrice] = []
    total_amount = 0  # в минимальных единицах валюты

    # Ждём формат:
    # { cafeteria: { name }, variant: { name, cost }, quantity }
    try:
        for item in order_items:
            name = item["cafeteria"]["name"]
            variant_name = item["variant"]["name"]
            # ВНИМАНИЕ: ожидаем, что cost уже в копейках/центах (целое число)
            cost_minor = int(item["variant"]["cost"])
            quantity = int(item["quantity"])

            amount = cost_minor * quantity
            total_amount += amount

            labeled_prices.append(
                LabeledPrice(
                    label=f"{name} ({variant_name}) x{quantity}",
                    amount=amount
                )
            )
    except Exception:
        return {"message": "Bad cart item format"}, 400

    # 3) Токен платёжного провайдера
    provider_token = os.getenv("PAYMENT_PROVIDER_TOKEN")
    if not provider_token:
        return {"message": "PAYMENT_PROVIDER_TOKEN not set"}, 500

    # Полезная нагрузка — положим туда сумму для примера
    payload_str = f"order-{total_amount}"

    # 4) Создаём ссылку на инвойс через bot.py
    try:
        invoice_url = bot.create_invoice_link(
            title="Заказ в кафе",
            description="Оплата корзины в MiniApp",
            payload=payload_str,
            provider_token=provider_token,
            currency="RUB",
            prices=labeled_prices,
            # При необходимости можно включить эти флаги:
            # need_name=True, need_phone_number=True, need_shipping_address=True
        )
    except Exception as e:
        return {"message": f"Failed to create invoice: {e}"}, 500

    return {"ok": True, "invoiceUrl": invoice_url}, 200


# Доп. health endpoint для аптайм-робота
@app.get("/health")
def health():
    return {"status": "ok"}, 200


# На старте обновляем вебхук (если реализовано внутри bot.py)
try:
    bot.refresh_webhook()
except Exception:
    # тихо игнорируем, чтобы деплой не падал, если вебхук ещё не настроен
    pass
