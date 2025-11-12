# backend/app/main.py

from __future__ import annotations

import os
import json
import secrets
from pathlib import Path
from typing import Optional, Tuple, Any, List, Dict

from flask import Flask, request, jsonify
from flask_cors import CORS

# auth.py лежит рядом (backend/app/auth.py). Используем мягко, чтобы не падать без него.
try:
    from . import auth as tgauth  # пакетный импорт
except Exception:
    import auth as tgauth  # на всякий случай, если запуск как модуль

# ----------- пути к данным -----------
BASE_DIR = Path(__file__).resolve().parent              # backend/app
DATA_DIR = BASE_DIR.parent / "data"                     # backend/data
MENU_DIR = DATA_DIR / "menu"                            # backend/data/menu

app = Flask(__name__)
CORS(app)


# ----------- утилиты -----------

def _safe_json_path(relpath: str) -> Path:
    """
    Возвращает безопасный путь к JSON в каталоге backend/data.
    Поддерживает подкаталоги, например 'menu/burgers' -> '.../data/menu/burgers.json'
    """
    rel = relpath.strip("/")

    # всегда добавляем .json, если пользователь не указал
    candidate = (DATA_DIR / f"{rel}").with_suffix(".json").resolve()

    # защита от выхода из каталога
    if not str(candidate).startswith(str(DATA_DIR.resolve())):
        # путь точно не существует — вернем фиктивный, чтобы позже получить "not found"
        return DATA_DIR / "__forbidden__.json"

    return candidate


def load_json(relpath: str) -> Tuple[Optional[Any], Optional[str]]:
    """
    Безопасно читает JSON по относительному пути внутри backend/data.
    Возвращает (данные, сообщение_об_ошибке_или_None)
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


# ----------- публичные GET -----------

@app.get("/")
def root():
    # Небольшая диагностическая инфа
    return jsonify({
        "ok": True,
        "env": os.getenv("FLASK_ENV", "production"),
        "version": "mini-patch-2025-11-11"
    })


@app.route("/health", methods=["GET", "HEAD"])
def health():
    # Хелсчек для UptimeRobot/Render
    return jsonify({"ok": True}), 200


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
    # ВАЖНО: читаем из backend/data/menu/popular.json
    data, err = load_json("menu/popular")
    if err:
        return json_error(err, 404)
    return jsonify(data)


@app.get("/menu/<category>")
def get_menu_category(category: str):
    """
    Возвращает список позиций меню для категории:
    /menu/burgers, /menu/pizza, /menu/pasta, /menu/coffee, /menu/ice-cream и т.д.
    """
    data, err = load_json(f"menu/{category}")
    if err:
        return json_error(err, 404)
    return jsonify(data)


@app.get("/menu/details/<item_id>")
def get_menu_details(item_id: str):
    """
    Ищем конкретный айтем по id во всех файлах backend/data/menu/*.json
    Пример: /menu/details/burger-1
    """
    if not MENU_DIR.exists():
        return json_error("menu directory not found", 404)

    try:
        for p in sorted(MENU_DIR.glob("*.json")):
            with p.open("r", encoding="utf-8") as f:
                data = json.load(f)

            # Ожидаем, что файл — массив объектов с полем "id"
            if isinstance(data, list):
                for it in data:
                    if isinstance(it, dict) and str(it.get("id")) == item_id:
                        return jsonify(it)

            # На всякий случай поддержим словари формата {"items": [...]}
            if isinstance(data, dict):
                items = data.get("items")
                if isinstance(items, list):
                    for it in items:
                        if isinstance(it, dict) and str(it.get("id")) == item_id:
                            return jsonify(it)

    except Exception as e:
        app.logger.exception("Failed to read menu details")
        return json_error(f"failed to search details: {e}", 500)

    return json_error("Not found", 404)


# ----------- создание заказа -----------

@app.post("/order")
def create_order():
    # всегда пытаемся парсить JSON
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request must be a JSON object", 400)

    auth_str = payload.get("_auth")
    cart_items = payload.get("cartItems", [])

    # (опционально) мягкая проверка Telegram initData
    bot_token = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token:
        try:
            if not isinstance(auth_str, str) or not tgauth.validate_auth_data(bot_token, auth_str):
                return json_error("Invalid Telegram auth data", 401)
        except Exception:
            # не падаем, если что-то пошло не так в validate_auth_data
            return json_error("Auth validation failed", 401)

    # Базовая валидация корзины
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

    # Здесь могла бы быть реальная логика создания/оплаты заказа
    order_id = secrets.token_hex(6)

    return jsonify({
        "ok": True,
        "orderId": order_id,
        "items": normalized,
    }), 200


# ----------- обработчики ошибок -----------

@app.errorhandler(404)
def not_found(e):
    return json_error("Not found", 404)


@app.errorhandler(500)
def internal_error(e):
    app.logger.exception("Unhandled server error")
    return json_error("Internal server error", 500)


# Локальный запуск (на Render используется gunicorn app.main:app)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
