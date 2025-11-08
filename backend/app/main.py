import os
import json
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from telebot.types import LabeledPrice

# ✅ правильные относительные импорты
from . import auth
from . import bot

load_dotenv()

app = Flask(__name__)
app.url_map.strict_slashes = False


# ✅ CORS
APP_URL = os.getenv("APP_URL")
DEV_APP_URL = os.getenv("DEV_APP_URL")

allowed_origins = [
    origin for origin in [
        APP_URL,
        DEV_APP_URL,
        "https://t.me",
        "https://web.telegram.org",
        "https://telegram.org"
    ]
    if origin
]

CORS(app, resources={
    r"/*": {
        "origins": allowed_origins or "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    }
})


# ✅ simple health-check
@app.route("/", methods=["GET"])
def health():
    return jsonify({"ok": True})


# ✅ /info endpoint
@app.route("/info", methods=["GET"])
def info():
    return jsonify({"message": "backend working"})


# ✅ endpoint оплаты
@app.route("/order", methods=["POST"])
def order():
    # 1. Проверяем JSON
    if not request.is_json:
        return jsonify({"message": "Request must be a JSON object"}), 400

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "Invalid JSON"}), 400

    # 2. Распаковка initData
    init_data = data.get("_auth")
    if not init_data:
        return jsonify({"message": "Missing _auth"}), 400

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        return jsonify({"message": "Bot token missing"}), 500

    # 3. Проверяем подпись Telegram InitData
    if not auth.validate_auth_data(bot_token, init_data):
        return jsonify({"message": "Invalid initData"}), 401

    # 4. Состав заказа
    cart_items = data.get("cartItems", [])
    if not isinstance(cart_items, list):
        return jsonify({"message": "cartItems must be list"}), 400

    if len(cart_items) == 0:
        return jsonify({"message": "Cart is empty"}), 400

    # 5. Счёт
    prices = []
    total_sum = 0

    for item in cart_items:
        name = item.get("variant", {}).get("name", "Item")
        cost = item.get("variant", {}).get("cost", 0)
        quantity = item.get("quantity", 1)

        price = int(cost)
        item_total = price * quantity
        total_sum += item_total

        prices.append(
            LabeledPrice(label=f"{name} x{quantity}", amount=item_total)
        )

    # 6. Отправка счета
    try:
        payload = json.dumps({"sum": total_sum})

        invoice = bot.bot.send_invoice(
            chat_id=json.loads(init_data)["user"]["id"],   # user_id из initData
            title="Order Payment",
            description="Payment for selected items",
            invoice_payload=payload,
            provider_token=os.getenv("PAYMENT_PROVIDER_TOKEN"),
            currency="UZS",
            prices=prices,
            start_parameter="payment"
        )

        return jsonify({"ok": True, "invoice": invoice.invoice_link})

    except Exception as e:
        return jsonify({"message": str(e)}), 500


# ✅ webhook или polling обрабатываются в bot.py
@app.route("/webhook", methods=["POST"])
def webhook():
    json_data = request.get_json()
    bot.bot.process_new_updates([bot.types.Update.de_json(json_data)])
    return jsonify({"ok": True})


# ✅ Render entrypoint
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
