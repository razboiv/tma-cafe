# backend/app/main.py

from __future__ import annotations

import os
import json
import secrets
from pathlib import Path
from typing import Tuple, Optional, Any, Dict, List

from flask import Flask, request, jsonify
from flask_cors import CORS

# ВАЖНО: bot.py лежит в этой же папке (backend/app),
# поэтому импорт вот такой:
from app.bot import process_update, refresh_webhook, enable_debug_logging


# ----------- пути к данным -----------

BASE_DIR = Path(__file__).resolve().parent      # backend/app
DATA_DIR = BASE_DIR.parent / "data"             # backend/data

app = Flask(__name__)
CORS(app)

# подробные логи TeleBot'а (видно в логах Render)
enable_debug_logging()


# ----------- утилиты работы с JSON -----------

def _safe_json_path(relpath: str) -> Path:
    """
    Возвращает безопасный путь к JSON внутри backend/data.
    Поддерживаем подпапки, например 'menu/burgers'.
    """
    rel = relpath.lstrip("/")
    candidate = (DATA_DIR / f"{rel}.json").resolve()

    # защита от выхода из каталога data
    if not str(candidate).startswith(str(DATA_DIR.resolve())):
        # вернём путь, который гарантированно не существует
        return DATA_DIR / "__forbidden__.json"

    return candidate


def load_json(relpath: str) -> Tuple[Optional[Any], Optional[str]]:
    """
    Безопасное чтение JSON по относительному пути внутри backend/data.
    Возвращает (данные, ошибка_или_None).
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


# ----------- health / root -----------

@app.get("/")
def root():
    """
    Корневой эндпоинт — удобно проверять руками и для UptimeRobot.
    """
    return jsonify(
        {
            "backend_url": "",
            "env": "production",
            "version": "mini-patch-2025-11-11",
        }
    )


@app.get("/health")
def health():
    """Эндпоинт для мониторинга (UptimeRobot)."""
    return jsonify({"status": "ok"}), 200


# ----------- публичные GET -----------

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


# ---- /menu/<category_id> ----

CATEGORY_FILE_MAP: Dict[str, str] = {
    "burgers": "burgers",
    "pizza": "pizza",
    "pasta": "pasta",
    "coffee": "coffee",
    "ice-cream": "ice-cream",
}


@app.get("/menu/<category_id>")
def get_menu_category(category_id: str):
    """
    /menu/burgers -> backend/data/menu/burgers.json
    /menu/pizza   -> backend/data/menu/pizza.json
    и т.д.
    """
    json_name = CATEGORY_FILE_MAP.get(category_id)
    if not json_name:
        return json_error("Not found", 404)

    data, err = load_json(f"menu/{json_name}")
    if err:
        return json_error(err, 404)

    return jsonify(data)


# ---- /menu/details/<item_id> ----

# по префиксу id определяем файл
DETAILS_PREFIX_MAP: Dict[str, str] = {
    "burger": "burgers",
    "pizza": "pizza",
    "pasta": "pasta",
    "coffee": "coffee",
    "ice-cream": "ice-cream",
}


@app.get("/menu/details/<item_id>")
def get_menu_details(item_id: str):
    """
    /menu/details/burger-1 -> ищем burger-1 внутри menu/burgers.json
    """
    prefix = item_id.split("-", 1)[0]   # 'burger-1' -> 'burger'
    json_name = DETAILS_PREFIX_MAP.get(prefix)
    if not json_name:
        return json_error("Not found", 404)

    items, err = load_json(f"menu/{json_name}")
    if err:
        return json_error(err, 404)

    if not isinstance(items, list):
        return json_error("Bad menu format", 500)

    item = next((it for it in items if it.get("id") == item_id), None)
    if not item:
        return json_error("Not found", 404)

    return jsonify(item)


# ----------- создание заказа из Mini App (Checkout) -----------

@app.post("/order")
def create_order():
    # JSON только объект
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("Request must be a JSON object", 400)

    auth_str = payload.get("_auth")
    cart_items = payload.get("cartItems", [])

    # мягкая проверка Telegram initData
    bot_token = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token and not isinstance(auth_str, str):
        return json_error("Invalid Telegram auth data", 401)

    # проверка корзины
    if not isinstance(cart_items, list):
        return json_error("cartItems must be an array", 400)

    normalized: List[Dict[str, Any]] = []

    for i, it in enumerate(cart_items):
        if not isinstance(it, dict):
            return json_error(f"Bad cart item at index {i}", 400)

        caf = it.get("cafeteria") or {}
        var = it.get("variant") or {}
        qty = it.get("quantity", 1)
        cost = var.get("cost")

        caf_id = caf.get("id") or caf.get("name")
        var_id = var.get("id") or var.get("name")

        if not caf_id or not var_id:
            return json_error(f"Bad cart item format at index {i}", 400)

        normalized.append(
            {
                "item": str(caf_id),
                "variant": str(var_id),
                "quantity": int(qty or 1),
                "cost": int(cost) if isinstance(cost, (int, float)) else None,
            }
        )

    order_id = secrets.token_hex(6)

    return jsonify(
        {
            "ok": True,
            "orderId": order_id,
            "items": normalized,
        }
    ), 200


# ----------- webhook от Telegram -----------

@app.post("/bot")
def telegram_webhook():
    """
    Сюда Telegram шлёт апдейты (сообщения, web_app_data, оплаты и т.д.).
    """
    update_json = request.get_json(silent=True, force=True)
    app.logger.debug("[WEBHOOK] /bot payload: %s", update_json)

    if not update_json:
        return jsonify({"ok": False}), 400

    process_update(update_json)
    return jsonify({"ok": True})


@app.get("/bot")
def webhook_debug():
    """Просто проверка, что эндпоинт жив."""
    return jsonify({"message": "webhook is alive"})


# ----------- обновление webhook'а -----------

@app.get("/refresh_webhook")
def refresh_webhook_route():
    """
    Снять старый webhook и прописать новый (WEBHOOK_URL + WEBHOOK_PATH).
    WEBHOOK_URL и WEBHOOK_PATH берутся из переменных окружения.
    """
    try:
        url = refresh_webhook()
        return jsonify({"status": "ok", "webhook": url})
    except Exception as e:
        app.logger.exception("Failed to refresh webhook: %s", e)
        return json_error(f"Failed to refresh webhook: {e}", 500)


# ----------- error handlers -----------

@app.errorhandler(404)
def not_found(e):
    return json_error("Not found", 404)


@app.errorhandler(500)
def internal_error(e):
    app.logger.exception("Unhandled server error", exc_info=e)
    return json_error("Internal server error", 500)


# ----------- локальный запуск -----------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
