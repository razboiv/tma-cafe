# backend/app/main.py

from __future__ import annotations

import os
import json
import secrets
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any

from flask import Flask, request, jsonify
from flask_cors import CORS

# ---- базовые пути ----
BASE_DIR = Path(__file__).resolve().parent          # backend/app
DATA_DIR = BASE_DIR.parent / "data"                 # backend/data
MENU_DIR = DATA_DIR / "menu"                        # backend/data/menu

app = Flask(__name__)
CORS(app)

# ---- utils ----
def _json_path(rel: str) -> Path:
    """
    Возвращает безопасный путь к JSON внутри backend/data.
    Поддерживает подкаталоги, напр. 'menu/popular' или 'menu/burgers'.
    """
    rel = rel.strip("/").replace("\\", "/")
    p = (DATA_DIR / f"{rel}.json").resolve()
    # защита от выхода из каталога данных
    if not str(p).startswith(str(DATA_DIR.resolve())):
        # заведомо несуществующий файл => отдадим 404
        return DATA_DIR / "__forbidden__.json"
    return p

def load_json(rel: str) -> Tuple[Optional[Any], Optional[str]]:
    """
    Безопасно читает JSON 'backend/data/<rel>.json'.
    Возвращает (data, error_message).
    """
    path = _json_path(rel)
    if not path.exists():
        return None, f"{path.name} not found"
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, f"failed to read '{rel}.json': {e}"

def json_error(message: str, code: int):
    resp = jsonify({"message": message})
    resp.status_code = code
    return resp

# ---- health & root ----
@app.get("/health")
def health():
    return jsonify({"ok": True, "env": os.getenv("ENV", "production")})

@app.get("/")
def root():
    return jsonify({
        "ok": True,
        "env": os.getenv("ENV", "production"),
        "version": os.getenv("VERSION", "mini-patch-2025-11-11"),
    })

# ---- публичные GET ----
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
    data, err = load_json("menu/popular")
    if err:
        return json_error(err, 404)
    return jsonify(data)

@app.get("/menu/<category>")
def get_menu_category(category: str):
    """
    Отдаёт список позиций для категории:
    /menu/burgers -> backend/data/menu/burgers.json
    /menu/pasta   -> backend/data/menu/pasta.json и т.д.
    """
    data, err = load_json(f"menu/{category}")
    if err:
        return json_error(err, 404)
    return jsonify(data)

@app.get("/menu/details/<item_id>")
def get_menu_item(item_id: str):
    """
    Ищет одну позицию по id в любом JSON из backend/data/menu/*.json.
    Например: /menu/details/burger-1
    """
    if not MENU_DIR.exists():
        return json_error("menu folder not found", 404)

    try:
        for path in MENU_DIR.glob("*.json"):
            with path.open("r", encoding="utf-8") as f:
                content = json.load(f)
            # файлы категорий — массив объектов
            if isinstance(content, list):
                for it in content:
                    if isinstance(it, dict) and str(it.get("id")) == item_id:
                        return jsonify(it)
        return json_error(f"{item_id}.json not found", 404)
    except Exception as e:
        app.logger.exception("Failed to search item details")
        return json_error(f"failed to search '{item_id}': {e}", 500)

# ---- создание заказа ----
@app.post("/order")
def create_order():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request must be a JSON object", 400)

    auth_str = payload.get("_auth")
    cart_items = payload.get("cartItems", [])

    # мягкая проверка initData, если нужен токен — добавь в env
    bot_token = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token and not isinstance(auth_str, str):
        return json_error("Invalid Telegram auth data", 401)

    if not isinstance(cart_items, list):
        return json_error("cartItems must be an array", 400)

    normalized: List[Dict[str, Any]] = []
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

# ---- error handlers ----
@app.errorhandler(404)
def not_found(e):
    return json_error("Not found", 404)

@app.errorhandler(500)
def internal_error(e):
    app.logger.exception("Unhandled server error")
    return json_error("Internal server error", 500)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
