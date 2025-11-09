# backend/app/main.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import os, json

app = Flask(__name__)
CORS(app)

# Папки с данными
BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))   # .../backend
DATA_DIR    = os.path.join(BACKEND_DIR, "data")
MENU_DIR    = os.path.join(DATA_DIR, "menu")

def load_json(filename: str):
    """Ищем файл сначала в data/, затем в data/menu/."""
    for base in (DATA_DIR, MENU_DIR):
        path = os.path.join(base, filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return None

@app.get("/")
def root():
    # чтобы health-check Render не видел 404
    return jsonify({"status": "ok", "service": "tma-cafe-backend"})

@app.get("/info")
def get_info():
    data = load_json("info.json")
    if data is None:
        return jsonify({"message": "info.json not found"}), 404
    return jsonify(data)

@app.get("/categories")
def get_categories():
    data = load_json("categories.json")
    if data is None:
        return jsonify({"message": "categories.json not found"}), 404
    return jsonify(data)

@app.get("/menu/popular")
def get_popular():
    data = load_json("popular.json")
    if data is None:
        return jsonify({"message": "popular.json not found"}), 404
    return jsonify(data)

@app.post("/order")
def create_order():
    # ожидаем JSON вида:
    # {"_auth": "...initData...", "cartItems":[{"cafeteria":{"name":...},"variant":{"name":...,"cost":1199},"quantity":1}, ...]}
    if not request.is_json:
        return jsonify({"message": "Request must be a JSON object"}), 400
    body = request.get_json(silent=True) or {}
    auth = body.get("_auth")
    cart_items = body.get("cartItems")

    if not auth or not isinstance(cart_items, list):
        return jsonify({"message": "Bad cart item format"}), 400

    # Минимальная валидация содержимого
    for item in cart_items:
        if not isinstance(item, dict):
            return jsonify({"message": "Bad cart item format"}), 400
        variant = (item.get("variant") or {})
        qty = item.get("quantity")
        if "cost" not in variant or qty is None:
            return jsonify({"message": "Bad cart item format"}), 400

    # Здесь могла бы быть реальная обработка/оплата
    return jsonify({"ok": True, "message": "Order received"}), 200

# для локального запуска: python -m app.main
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
