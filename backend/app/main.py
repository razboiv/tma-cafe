import os
from flask import Flask, request
from flask_cors import CORS
import telebot
from telebot import types
import json

import auth  # твой local auth.py (Telegram initData check)

app = Flask(__name__)
CORS(app)

BOT_TOKEN = os.getenv("BOT_TOKEN")
PAYMENT_PROVIDER_TOKEN = os.getenv("PAYMENT_PROVIDER_TOKEN")
bot = telebot.TeleBot(BOT_TOKEN)


@app.route("/order", methods=["POST"])
def create_order():
    """
    Принимаем initData + корзину, формируем invoiceLink и возвращаем его.
    """

    # ✅ Получаем JSON безопасно
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        # Пробуем разобрать вручную (если пришла строка)
        try:
            data = json.loads(request.data.decode("utf-8"))
        except Exception:
            return {"message": "Request must be a JSON object"}, 400

    # ✅ Проверяем initData
    auth_data = data.get("_auth")
    if not auth_data:
        return {"message": "Missing auth data"}, 400

    if not auth.validate_auth_data(BOT_TOKEN, auth_data):
        return {"message": "Invalid auth data"}, 401

    # ✅ Проверяем корзину
    order_items = data.get("cartItems")
    if not order_items or not isinstance(order_items, list):
        return {"message": "Cart is empty"}, 400

    labeled_prices = []
    total_kopecks = 0

    for item in order_items:
        try:
            name = item["cafeteria"]["name"]
            variant = item["variant"]["name"]
            cost_rub = int(item["variant"]["cost"])
            quantity = int(item["quantity"])
        except Exception:
            return {"message": "Bad cart item format"}, 400

        amount = cost_rub * quantity * 100
        total_kopecks += amount

        labeled_prices.append(
            types.LabeledPrice(
                label=f"{name} ({variant}) x{quantity}",
                amount=amount
            )
        )

    if not PAYMENT_PROVIDER_TOKEN:
        return {"message": "PAYMENT_PROVIDER_TOKEN not set"}, 500

    payload = f"order-{total_kopecks}"

    invoice_url = bot.create_invoice_link(
        title="Order Payment",
        description="Payment for items in your cart",
        payload=payload,
        provider_token=PAYMENT_PROVIDER_TOKEN,
        currency="RUB",
        prices=labeled_prices,
    )

    return {"ok": True, "invoiceUrl": invoice_url}, 200


@app.route("/", methods=["GET"])
def home():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
