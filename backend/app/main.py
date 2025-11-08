import os
import json
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from telebot.types import LabeledPrice

from . import auth
from . import bot

load_dotenv()

app = Flask(__name__)
app.url_map.strict_slashes = False

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
    resources=r"/**",
    origins=allowed_origins or "*",
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=False,
)


@app.route("/", methods=["GET"])
def root_ok():
    return {"ok": True}, 200


@app.route(bot.WEBHOOK_PATH, methods=["POST"])
@app.route(f"/{bot.WEBHOOK_PATH}", methods=["POST"])
def bot_webhook():
    update = request.get_json(force=True, silent=True)
    bot.process_update(update)
    return {"message": "OK"}, 200


def _json_data(path: str):
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/info")
def info():
    try:
        return _json_data("data/info.json")
    except FileNotFoundError:
        return {"message": "Info file not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


@app.route("/categories")
def categories():
    try:
        return _json_data("data/categories.json")
    except FileNotFoundError:
        return {"message": "categories file not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


@app.route("/menu/<category_id>")
def category_menu(category_id: str):
    try:
        return _json_data(f"data/menu/{category_id}.json")
    except FileNotFoundError:
        return {"message": f"No menu found for {category_id}"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


@app.route("/menu/details/<menu_item_id>")
def menu_item_details(menu_item_id: str):
    try:
        folder = "data/menu"
        for fname in os.listdir(folder):
            if not fname.endswith(".json"):
                continue
            items = _json_data(os.path.join(folder, fname))
            desired = next((m for m in items if m.get("id") == menu_item_id), None)
            if desired:
                return desired
        return {"message": f"Item {menu_item_id} not found"}, 404
    except FileNotFoundError:
        return {"message": "Menu data not found"}, 404
    except Exception as e:
        return {"message": f"Unexpected error: {e}"}, 500


@app.route("/order", methods=["POST"])
def create_order():
    try:
        req = request.get_json(force=True, silent=True)
        if not isinstance(req, dict):
            return {"message": "Request must be a JSON object"}, 400

        auth_data = req.get("_auth")
        if not auth_data or not auth.validate_auth_data(os.getenv("BOT_TOKEN", ""), auth_data):
            return {"message": "Invalid auth data"}, 401

        order_items = req.get("cartItems")
        if not isinstance(order_items, list) or not order_items:
            return {"message": "Cart is empty"}, 400

        labeled_prices = []
        total_kopecks = 0

        for item in order_items:
            try:
                name = item["cafeteria"]["name"]
                variant_name = item["variant"]["name"]
                cost_rub = int(item["variant"]["cost"])
                qty = int(item["quantity"])
            except (KeyError, TypeError, ValueError):
                return {"message": "Bad cart item format"}, 400

            amount = cost_rub * qty * 100
            total_kopecks += amount

            labeled_prices.append(
                LabeledPrice(
                    label=f"{name} ({variant_name}) x{qty}",
                    amount=amount
                )
            )

        provider_token = os.getenv("PAYMENT_PROVIDER_TOKEN")
        if not provider_token:
            return {"message": "PAYMENT_PROVIDER_TOKEN not set"}, 500

        payload = f"order-{total_kopecks}"

        invoice_url = bot.create_invoice_link(
            title="Заказ в магазине",
            description="Оплата корзины в MiniApp",
            payload=payload,
            provider_token=provider_token,
            currency="RUB",
            prices=labeled_prices,
        )

        return {"ok": True, "invoiceUrl": invoice_url}, 200

    except Exception as e:
        return {"message": f"Server error: {e}"}, 500


@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok"}, 200


bot.refresh_webhook()
