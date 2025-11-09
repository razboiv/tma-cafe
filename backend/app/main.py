# backend/app/main.py
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Tuple, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

# auth.py лежит в той же папке (backend/app/auth.py)
from . import auth  # type: ignore

app = Flask(__name__)
CORS(app)

# ---------- utils ----------

def _proj_path(*parts: str) -> str:
    """Абсолютный путь от корня backend."""
    here = os.path.dirname(os.path.abspath(__file__))          # .../backend/app
    backend_root = os.path.dirname(here)                       # .../backend
    return os.path.join(backend_root, *parts)

def _load_json(rel_path: str) -> Any:
    """Безопасно читает JSON из backend/<rel_path>."""
    path = _proj_path(rel_path)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _error(message: str, code: int):
    return jsonify({"message": message}), code

def _get_payload() -> Dict[str, Any]:
    """
    Бэк совместим и с JSON, и с form-urlencoded.
    Возвращает dict (пустой если ничего не пришло).
    """
    data: Optional[Dict[str, Any]] = None
    # 1) JSON
    if request.is_json:
        data = request.get_json(silent=True)
    # 2) form (например, jQuery $.post без явного contentType)
    if not data:
        if request.form:
            # преобразуем MultiDict -> dict
            data = {}
            for k, v in request.form.items():
                # если строка похожа на JSON — распарсим
                if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                    try:
                        data[k] = json.loads(v)
                    except Exception:
                        data[k] = v
                else:
                    data[k] = v
    # 3) raw body как JSON (на всякий случай)
    if not data:
        try:
            data = json.loads(request.data.decode("utf-8"))
        except Exception:
            data = {}
    return data or {}

# ---------- routes: health ----------

@app.get("/")
def root_ok():
    return jsonify({"ok": True, "service": "tma-cafe-backend"})

# ---------- routes: catalog ----------

@app.get("/info")
def get_info():
    """
    Общая информация о кафе.
    Ожидает файл: backend/menu/info.json
    """
    try:
        info = _load_json(os.path.join("menu", "info.json"))
        return jsonify(info)
    except FileNotFoundError:
        return _error("info.json not found", 404)

@app.get("/categories")
def get_categories():
    """
    Список категорий. Файл: backend/menu/categories.json
    """
    try:
        cats = _load_json(os.path.join("menu", "categories.json"))
        return jsonify(cats)
    except FileNotFoundError:
        return _error("categories.json not found", 404)

@app.get("/menu/popular")
def get_popular():
    """
    Популярные позиции. Файл: backend/menu/popular.json
    """
    try:
        popular = _load_json(os.path.join("menu", "popular.json"))
        return jsonify(popular)
    except FileNotFoundError:
        return _error("popular.json not found", 404)

@app.get("/menu/<category>")
def get_menu_category(category: str):
    """
    Позиции конкретной категории.
    Ожидаемые имена файлов: burgers.json, pizza.json, coffee.json, ice-cream.json, pasta.json и т.п.
    Лежат в backend/menu/<category>.json
    """
    safe = f"{category}.json"
    try:
        data = _load_json(os.path.join("menu", safe))
        return jsonify(data)
    except FileNotFoundError:
        return _error(f"{safe} not found", 404)

# ---------- routes: order ----------

def _validate_cart_items(cart_items: Any) -> Tuple[bool, str]:
    """
    Базовая валидация корзины.
    Ждём список элементов вида:
      {
        "cafeteria": {"name": "..."},
        "variant":   {"name": "...", "cost": 1199},
        "quantity":  1
      }
    """
    if not isinstance(cart_items, list) or not cart_items:
        return False, "cartItems must be a non-empty list"

    for i, item in enumerate(cart_items):
        if not isinstance(item, dict):
            return False, f"cartItems[{i}] must be an object"
        cafe = item.get("cafeteria", {})
        variant = item.get("variant", {})
        qty = item.get("quantity")
        if not isinstance(cafe, dict) or "name" not in cafe:
            return False, f"cartItems[{i}].cafeteria.name is required"
        if not isinstance(variant, dict) or "name" not in variant or "cost" not in variant:
            return False, f"cartItems[{i}].variant.name and .cost are required"
        if not isinstance(qty, int) or qty <= 0:
            return False, f"cartItems[{i}].quantity must be positive int"
    return True, "ok"

@app.post("/order")
def create_order():
    """
    Принимает заказ.
    Тело: { "_auth": "<initData>", "cartItems": [ ... ] }
    Возвращает: { "ok": true, "total": <cents>, "positions": <int> }
    """
    payload = _get_payload()
    if not isinstance(payload, dict):
        return _error("Request must be a JSON object", 400)

    init_data = payload.get("_auth")
    if not isinstance(init_data, str) or not init_data:
        return _error("Missing _auth", 400)

    # Проверка подписи Mini App initData
    bot_token = os.getenv("BOT_TOKEN", "").strip()
    if not bot_token:
        return _error("Server misconfigured: BOT_TOKEN is empty", 500)

    try:
        if not auth.validate_auth_data(bot_token, init_data):
            return _error("Unauthorized: bad _auth", 401)
    except Exception:
        # если вдруг в init_data передали объект (не строку) — тоже ошибка
        return _error("Unauthorized: _auth parse error", 401)

    cart_items = payload.get("cartItems")
    ok, msg = _validate_cart_items(cart_items)
    if not ok:
        return _error(msg, 400)

    # Подсчёт суммы (в центах/копейках)
    total = 0
    positions = 0
    for item in cart_items:
        cost = int(item["variant"]["cost"])
        qty = int(item["quantity"])
        total += cost * qty
        positions += qty

    # Здесь могла бы быть интеграция с оплатой/биллинговым провайдером
    return jsonify({
        "ok": True,
        "total": total,
        "positions": positions,
        "message": "Order accepted (demo)."
    })

# ---------- entrypoint for Render / gunicorn ----------

# Нужен объект app в модуле app.main для строки запуска:
# gunicorn -b 0.0.0.0:$PORT app.main:app

if __name__ == "__main__":
    # локальный запуск: python -m app.main
    port = int(os.getenv("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=True)
