import json
import os
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from telebot.types import LabeledPrice
from . import auth, bot

# Загружаем переменные окружения (.env)
load_dotenv()

app = Flask(__name__)
app.url_map.strict_slashes = False  # чтобы не было редиректа /bot -> /bot/

# Разрешаем фронту обращаться к API
allowed_origins = [os.getenv('APP_URL')]
if os.getenv('DEV_MODE'):
    allowed_origins.append(os.getenv('DEV_APP_URL'))
    bot.enable_debug_logging()

CORS(app, origins=list(filter(lambda o: o is not None, allowed_origins)))


# ===============================
# Telegram Webhook
# ===============================
@app.route(bot.WEBHOOK_PATH, methods=['POST'])
@app.route(f"{bot.WEBHOOK_PATH}/", methods=['POST'])  # Обрабатываем и со слэшем, и без
def bot_webhook():
    """
    Entry point for Telegram updates
    """
    update = request.get_json(force=True)
    bot.process_update(update)
    return {'message': 'OK'}, 200


# ===============================
# Public API
# ===============================
@app.route('/info')
def info():
    try:
        return json_data('data/info.json')
    except FileNotFoundError:
        return {'message': 'Info file not found'}, 404


@app.route('/categories')
def categories():
    try:
        return json_data('data/categories.json')
    except FileNotFoundError:
        return {'message': 'Categories file not found'}, 404


@app.route('/menu/<category_id>')
def category_menu(category_id: str):
    try:
        return json_data(f'data/menu/{category_id}.json')
    except FileNotFoundError:
        return {'message': f'No menu found for {category_id}'}, 404


@app.route('/menu/details/<menu_item_id>')
def menu_item_details(menu_item_id: str):
    try:
        data_folder_path = 'data/menu'
        for data_file in os.listdir(data_folder_path):
            menu_items = json_data(f'{data_folder_path}/{data_file}')
            desired_item = next((m for m in menu_items if m['id'] == menu_item_id), None)
            if desired_item:
                return desired_item
        return {'message': f'Item {menu_item_id} not found'}, 404
    except FileNotFoundError:
        return {'message': 'Menu data not found'}, 404


# ===============================
# YooKassa / Telegram Payments
# ===============================
@app.route('/order', methods=['POST'])
def create_order():
    request_data = request.get_json(force=True)

    # 1. Проверяем auth
    auth_data = request_data.get('_auth')
    if not auth_data or not auth.validate_auth_data(bot.BOT_TOKEN, auth_data):
        return {'message': 'Invalid auth data'}, 401

    # 2. Проверяем корзину
    order_items = request_data.get('cartItems')
    if not order_items:
        return {'message': 'Cart is empty'}, 400

    labeled_prices = []
    total_kopecks = 0

    for item in order_items:
        name = item['cafeteria']['name']
        variant = item['variant']['name']
        cost = int(item['variant']['cost'])
        quantity = int(item['quantity'])

        amount = cost * quantity * 100
        total_kopecks += amount

        labeled_prices.append(
            LabeledPrice(label=f'{name} ({variant}) x{quantity}', amount=amount)
        )

    # 3. Платёжный токен (YooKassa)
    provider_token = os.getenv('PAYMENT_PROVIDER_TOKEN')
    if not provider_token:
        return {'message': 'PAYMENT_PROVIDER_TOKEN not set'}, 500

    payload = f"order-{total_kopecks}"
    invoice_url = bot.create_invoice_link(
        title='Заказ в магазине',
        description='Оплата корзины в MiniApp',
        payload=payload,
        provider_token=provider_token,
        currency='RUB',
        prices=labeled_prices,
    )

    return {'ok': True, 'invoiceUrl': invoice_url}, 200


# ===============================
# Helper
# ===============================
def json_data(file_path: str):
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    raise FileNotFoundError

# Refresh webhook (при запуске)
# ===============================
bot.refresh_webhook()
# ===============================
