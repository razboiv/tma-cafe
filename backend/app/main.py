import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from telebot.types import LabeledPrice

# важное: импортируем наш бот (вебхук/инвойсы)
from app import auth, bot
from app.bot import process_update, refresh_webhook  # удобные врапперы

# ---------------- базовая настройка Flask ----------------

app = Flask(__name__)
app.url_map.strict_slashes = False  # чтобы /info и /info/ были одинаковыми

# CORS — берём из ENV, по умолчанию разрешаем всё
CORS(app, resources={r"/*": {"origins": os.getenv("CORS_ORIGINS", "*")}})

# ---------------- пути к данным --------------------------

# .../backend
BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
# .../backend/data
DATA_DIR = os.path.join(BACKEND_DIR, "data")
# .../backend/data/menu
MENU_DIR = os.path.join(DATA_DIR, "menu")


def _read_json(abs_path: str):
    """Читает JSON по абсолютному пути, бросает FileNotFoundError если нет файла."""
    with open(abs_path, "r", encoding="utf-8") as f:
        return json.load(f)


def read_data(rel_path: str):
    """Читает JSON из backend/data/<rel_path>"""
    abs_path = os.path.join(DATA_DIR, rel_path)
    return _read_json(abs_path)


def read_menu(category_filename: str):
    """Читает JSON из backend/data/menu/<category_filename>"""
    abs_path = os.path.join(MENU_DIR, category_filename)
    return _read_json(abs_path)


# ---------------- health -------------------------------

@app.get("/health")
def health():
    return jsonify({"status": "ok"})


# ---------------- info / categories --------------------

@app.get("/info")
def info():
    # ВАЖНО: читаем из data/info.json (а не из data/menu/info.json)
    try:
        return jsonify(read_data("info.json"))
    except FileNotFoundError:
        return jsonify({"message": "Could not find info data."}), 404


@app.get("/categories")
def categories():
    # ВАЖНО: читаем из data/categories.json (а не из data/menu/categories.json)
    try:
        return jsonify(read_data("categories.json"))
    except FileNotFoundError:
        return jsonify({"message": "Could not find categories data."}), 404


# ---------------- menu -------------------------------

@app.get("/menu/<category_id>")
def category_menu(category_id: str):
    """Возвращает список позиций из категории.
       example: /menu/popular -> data/menu/popular.json
    """
    try:
        return jsonify(read_menu(f"{category_id}.json"))
    except FileNotFoundError:
        return jsonify({"message": f"Could not find `{category_id}` category data."}), 404


@app.get("/menu/details/<menu_item_id>")
def menu_item_details(menu_item_id: str):
    """Ищем конкретную позицию по её ID во всех файлах data/menu/*.json"""
    try:
        for filename in os.listdir(MENU_DIR):
            if not filename.endswith(".json"):
                continue
            items = read_menu(filename)
            found = next((it for it in items if it.get("id") == menu_item_id), None)
            if found:
                return jsonify(found)
        return jsonify({"message": f"Could not find item with id `{menu_item_id}`."}), 404
    except FileNotFoundError:
        return jsonify({"message": "Menu data folder not found."}), 404


# ---------------- order / оплата -----------------------

@app.post("/order")
def create_order():
    """Создаёт инвойс (invoiceUrl) для оплаты в Mini App.
       1) валидируем initData (_auth)
       2) конвертим корзину в список LabeledPrice
       3) отдаём invoiceUrl
    """
    request_data = request.get_json(silent=True) or {}

    # 1) проверяем initData
    init_data = request_data.get("_auth")
    if not init_data or not auth.validate_auth_data(bot.BOT_TOKEN, init_data):
        return jsonify({"message": "Request data should contain valid auth data."}), 401

    # 2) конвертим корзину в цены
    order_items = request_data.get("cartItems")
    if not order_items:
        return jsonify({"message": "Cart items are not provided."}), 400

    labeled_prices = []
    for order_item in order_items:
        name = order_item["cafeItem"]["name"]
        variant = order_item["variant"]["name"]
        cost = int(order_item["variant"]["cost"])
        quantity = int(order_item["quantity"])
        amount = cost * quantity  # в минимальных единицах валюты (центах)
        labeled_prices.append(
            LabeledPrice(label=f"{name} ({variant}) x{quantity}", amount=amount)
        )

    # 3) создаём ссылку на инвойс через наш bot.py
    invoice_url = bot.create_invoice_link(prices=labeled_prices)
    return jsonify({"invoiceUrl": invoice_url})


# ---------------- Telegram webhook ---------------------

@app.post(bot.WEBHOOK_PATH)
def bot_webhook():
    """Точка входа для апдейтов Telegram (webhook)."""
    process_update(request.get_json())
    return jsonify({"message": "OK"})


@app.get("/refresh-webhook")
def refresh_webhook_route():
    """Удобно дернуть в браузере после деплоя, чтобы обновить вебхук."""
    refresh_webhook()
    return jsonify({"message": "Webhook was refreshed"})


# ---------------- root (опционально) -------------------

@app.get("/")
def root():
    return jsonify(
        {
            "service": "tma-cafe-backend",
            "env": "production",
            "webhook_path": bot.WEBHOOK_PATH,
        }
    )


# На старте приложения сразу ставим вебхук
bot.refresh_webhook()
