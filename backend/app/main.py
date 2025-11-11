# backend/app/main.py
import os
import hmac
import hashlib
import urllib.parse as urlparse
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ---- Health / Info ----
@app.get("/")
def root():
    # Нужен Render для health check
    return "ok true", 200

@app.get("/info")
def info():
    return jsonify({
        "ok": True,
        "name": "tma-cafe-backend",
        "env": os.getenv("NODE_ENV", "production")
    }), 200

# ---- Telegram WebApp auth verify ----
def verify_init_data(init_data: str, bot_token: str) -> bool:
    """
    Проверка подписи initData из Telegram WebApp:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    """
    try:
        secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()

        # Разбираем initData вида "k=v&k2=v2..."
        pairs = [p for p in init_data.split("&") if p]
        kv = {}
        hash_value = None
        for p in pairs:
            if "=" not in p:
                continue
            k, v = p.split("=", 1)
            if k == "hash":
                hash_value = v
            else:
                # Значения в строке проверки должны быть URL-decoded
                kv[k] = urlparse.unquote_plus(v)

        if not hash_value:
            return False

        # data_check_string — все пары кроме hash, сортировка по ключу, формат "key=value" через \n
        data_check_string = "\n".join(f"{k}={kv[k]}" for k in sorted(kv.keys()))

        calc_hash = hmac.new(
            secret_key,
            data_check_string.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        return calc_hash == hash_value
    except Exception:
        return False

# ---- Order endpoint ----
@app.post("/order")
def order():
    """
    Принимает JSON:
    {
      "_auth": "<initData из Telegram WebApp>",
      "cartItems": [
         {"cafeteria": {"name": "Hamburger"},
          "variant": {"name": "Small","cost": 1199},
          "quantity": 1}
      ]
    }
    Возвращает ok и рассчитанный total. Дальше сюда можно подвязать платежку.
    """
    payload = request.get_json(silent=True) or {}

    init_data = payload.get("_auth") or payload.get("auth") or ""
    cart_items = payload.get("cartItems", [])

    bot_token = os.getenv("BOT_TOKEN", "")
    if not bot_token:
        return jsonify({"ok": False, "error": "BOT_TOKEN is not set"}), 500

    if not init_data or not verify_init_data(init_data, bot_token):
        return jsonify({"ok": False, "error": "auth_failed"}), 401

    try:
        total = 0
        for item in cart_items:
            variant = item.get("variant", {})
            cost = int(variant.get("cost", 0))
            qty = int(item.get("quantity", 1))
            total += cost * qty

        # здесь вы можете вернуть то, что требуется фронту для pay
        return jsonify({
            "ok": True,
            "result": {
                "total": total,
                "currency": "RUB"  # или нужную вам валюту
            }
        }), 200

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

# Локальный запуск (на Render не используется, но не мешает)
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
