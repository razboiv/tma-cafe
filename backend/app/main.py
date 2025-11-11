# backend/app/main.py

from __future__ import annotations
import os
import json
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

# auth.py лежит рядом (backend/app/auth.py)
try:
    from . import auth as tgauth  # пакетный импорт
except Exception:
    import auth as tgauth  # на всякий

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data"  # backend/data

app = Flask(__name__)
CORS(app)

def load_json(name: str):
    """Безопасно читаем JSON из backend/data/*.json"""
    p = DATA_DIR / f"{name}.json"
    if not p.exists():
        return None, f"{name}.json not found"
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, f"failed to read {p.name}: {e}"

def json_error(message: str, code: int):
    resp = jsonify({"message": message})
    resp.status_code = code
    return resp

# -------- PUBLIC GET --------

@app.get("/info")
def get_info():
    data, err = load_json("info")
    if err:
        return json_error(err, 404)
    return jsonify(data)

@app.get("/categories")
def get_categories():
    data, err = load_json("categories")
    if err:
        return json_error(err, 404)
    return jsonify(data)

@app.get("/menu/popular")
def get_popular():
    data, err = load_json("popular")
    if err:
        return json_error(err, 404)
    return jsonify(data)

# -------- ORDER --------

@app.post("/order")
def create_order():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request must be a JSON object", 400)

    auth_str = payload.get("_auth")
    cart_items = payload.get("cartItems", [])

    # Проверка Telegram init data
    bot_token = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token:
        try:
            if not isinstance(auth_str, str) or not tgauth.validate_auth_data(bot_token, auth_str):
                return json_error("Invalid Telegram auth data", 401)
        except:
            return json_error("Auth validation failed", 401)

    if not isinstance(cart_items, list):
        return json_error("cartItems must be an array", 400)

    normalized = []

    for i, it in enumerate(cart_items):
        # ✅ твой реальный формат
        item_id = it.get("id")
        name = it.get("name")
        price = it.get("price")
        qty = it.get("quantity", 1)

        if not item_id:
            return json_error(f"Bad cart item at index {i}: missing id", 400)

        normalized.append({
            "item": str(item_id),
            "name": name,
            "quantity": int(qty),
            "cost": int(price) if isinstance(price, (int, float)) else None
        })

    # Генерация ID заказа
    order_id = os.urandom(6).hex()

    return jsonify({
        "ok": True,
        "orderId": order_id,
        "items": normalized
    }), 200

    # Всегда пытаемся парсить JSON
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request must be a JSON object", 400)

    auth_str = payload.get("_auth")
    cart_items = payload.get("cartItems", [])

    # Проверка Telegram initData (мягкая: если BOT_TOKEN не задан, не валим)
    bot_token = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token:
        try:
            if not isinstance(auth_str, str) or not tgauth.validate_auth_data(bot_token, auth_str):
                return json_error("Invalid Telegram auth data", 401)
        except Exception:
            # не падаем, если что-то пошло не так в validate_auth_data
            return json_error("Auth validation failed", 401)

    # Очень базовая валидация корзины
    if not isinstance(cart_items, list):
        return json_error("cartItems must be an array", 400)

    # Приводим элементы к безопасной форме
    normalized = []
    for i, it in enumerate(cart_items):
        if not isinstance(it, dict):
            return json_error(f"Bad cart item at index {i}", 400)
        caf = (it.get("cafeteria") or {})
        var = (it.get("variant") or {})
        qty = it.get("quantity", 1)
        # принимаем либо id, либо name
        caf_id = caf.get("id") or caf.get("name")
        var_id = var.get("id") or var.get("name")
        cost = var.get("cost")

        if not caf_id or not var_id:
            return json_error(f"Bad cart item format at index {i}", 400)

        normalized.append({
            "item": str(caf_id),
            "variant": str(var_id),
            "quantity": int(qty or 1),
            "cost": int(cost) if isinstance(cost, (int, float)) else None
        })

    # Тут могла бы быть реальная логика оплаты/создания заказа
    order_id = os.urandom(6).hex()

    return jsonify({
        "ok": True,
        "orderId": order_id,
        "items": normalized
    }), 200

# -------- JSON error handlers --------

@app.errorhandler(404)
def not_found(e):
    return json_error("Not found", 404)

@app.errorhandler(500)
def internal_error(e):
    # Пишем в логи Render, но фронту — JSON
    app.logger.exception("Unhandled server error")
    return json_error("Internal server error", 500)

if __name__ == "__main__":
    # локально
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
