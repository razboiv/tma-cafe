# backend/app/main.py

from __future__ import annotations

import os
import json
import secrets
from pathlib import Path
from typing import Tuple, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS

# ---- пути к данным ----
BASE_DIR = Path(__file__).resolve().parent      # backend/app
DATA_DIR = BASE_DIR.parent / "data"             # backend/data

app = Flask(__name__)
CORS(app)


# ------------ утилиты ------------

def _safe_json_path(relpath: str) -> Path:
    """
    Возвращает безопасный путь к JSON внутри backend/data.
    Поддерживает подпапки: 'menu/popular', 'menu/burgers', 'menu/details/burger-1' и т.п.
    """
    rel = relpath.strip("/")

    candidate = (DATA_DIR / f"{rel}.json").resolve()
    if not str(candidate).startswith(str(DATA_DIR.resolve())):
        # защита от выхода из каталога данных
        return DATA_DIR / "__forbidden__.json"
    return candidate


def load_json(relpath: str) -> Tuple[Optional[object], Optional[str]]:
    """
    Безопасно читает JSON по относительному пути внутри backend/data.
    Возвращает (data, error_message).
    """
    p = _safe_json_path(relpath)
    if not p.exists():
        return None, f"{p.name} not found"
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, f"failed to read '{relpath}.json': {e}"


def json_error(message: str, code: int):
    resp = jsonify({"message": message})
    resp.status_code = code
    return resp


# ------------ публичные GET ------------

@app.get("/")
def root():
    # Простой ответ для проверки
    return jsonify({"ok": True})


@app.get("/healthz")
def healthz():
    # Лёгкий health-check для UptimeRobot/Render
    return jsonify({
        "status": "ok",
        "env": os.getenv("RENDER", "local") or "local",
        "version": "mini-patch-2025-11-11"
    })


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
    # читает backend/data/menu/popular.json
    data, err = load_json("menu/popular")
    if err:
        return json_error(err, 404)
    return jsonify(data)


@app.get("/menu/<category_id>")
def get_menu_category(category_id: str):
    # читает backend/data/menu/<category_id>.json (burgers, pizza, pasta, ice-cream, coffee, …)
    data, err = load_json(f"menu/{category_id}")
    if err:
        return json_error("Not found", 404)
    return jsonify(data)


@app.get("/menu/details/<item_id>")
def get_menu_item_details(item_id: str):
    # читает backend/data/menu/details/<item_id>.json  (пример: burger-1.json)
    data, err = load_json(f"menu/details/{item_id}")
    if err:
        return json_error("Not found", 404)
    return jsonify(data)


# ------------ создание заказа ------------

@app.post("/order")
def create_order():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request must be a JSON object", 400)

    auth_str = payload.get("_auth")
    cart_items = payload.get("cartItems", [])

    # (опционально) мягкая проверка Telegram initData
    bot_token = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token and not isinstance(auth_str, str):
        return json_error("Invalid Telegram auth data", 401)

    if not isinstance(cart_items, list):
        return json_error("cartItems must be an array", 400)

    normalized = []
    for i, it in enumerate(cart_items):
        if not isinstance(it, dict):
            return json_error(f"Bad cart item at index {i}", 400)

        caf = it.get("cafeteria") or {}
        var = it.get("variant") or {}
        qty = it.get("quantity", 1)

        caf_id = caf.get("id") or caf.get("name")
        var_id = var.get("id") or var.get("name")
        cost = var.get("cost")

        if not caf_id or not var_id:
            return json_error(f"Bad cart item format at index {i}", 400)

        normalized.append({
            "item": str(caf_id),
            "variant": str(var_id),
            "quantity": int(qty or 1),
            "cost": int(cost) if isinstance(cost, (int, float)) else None,
        })

    order_id = secrets.token_hex(6)
    return jsonify({"ok": True, "orderId": order_id, "items": normalized}), 200


# ------------ error handlers ------------

@app.errorhandler(404)
def not_found(e):
    return json_error("Not found", 404)


@app.errorhandler(500)
def internal_error(e):
    app.logger.exception("Unhandled server error")
    return json_error("Internal server error", 500)


if __name__ == "__main__":
    # локальный запуск
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
