import json
import os

from . import auth, bot
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from telebot.types import LabeledPrice

# Загрузка .env (на Vercel берутся значения из Environment Variables)
load_dotenv()

app = Flask(__name__)
# Обрабатываем /info и /info/
app.url_map.strict_slashes = False

# CORS: разрешаем фронту стучаться на бэк
allowed_origins = [os.getenv('APP_URL')]
if os.getenv('DEV_MODE') is not None:
    allowed_origins.append(os.getenv('DEV_APP_URL'))
    bot.enable_debug_logging()

CORS(app, origins=list(filter(lambda o: o is not None, allowed_origins)))

# ==============================
# Telegram webhook endpoint
# ==============================
@app.route(bot.WEBHOOK_PATH, methods=['POST'])
def bot_webhook():
    """
    Entry point for Bot update sent via Telegram API.
    """
    bot.process_update(request.get_json())
    return { 'message': 'OK' }


# ==============================
# Public API
# ==============================
@app.route('/info')
def info():
    """
    API endpoint for providing info about the cafe/shop.
    """
    try:
        return json_data('data/info.json')
    except FileNotFoundError:
        return { 'message': 'Could not find info data.' }, 404


@app.route('/categories')
def categories():
    """
    API endpoint for providing available categories.
    """
    try:
        return json_data('data/categories.json')
    except FileNotFoundError:
        return { 'message': 'Could not find categories data.' }, 404


@app.route('/menu/<category_id>')
def category_menu(category_id: str):
    """
    API endpoint for providing menu list of specified category.
    """
    try:
        return json_data(f'data/menu/{category_id}.json')
    except FileNotFoundError:
        return { 'message': f'Could not find {category_id} category data.' }, 404


@app.route('/menu/details/<menu_item_id>')
def menu_item_details(menu_item_id: str):
    """
    API endpoint for providing menu item details.
    """
    try:
        data_folder_path = 'data/menu'
        for data_file in os.listdir(data_folder_path):
            menu_items = json_data(f'{data_folder_path}/{data_file}')
            desired_menu_item = next((mi for mi in menu_items if mi['id'] == menu_item_id), None)
            if desired_menu_item is not None:
                return desired_menu_item
        return { 'message': f'Could not find menu item data with {menu_item_id} ID.' }, 404
    except FileNotFoundError:
        return { 'message': f'Could not find menu item data with {menu_item_id} ID.' }, 404


# ==============================
# Order + Telegram Payments (YooKassa)
# ==============================
@app.route('/order', methods=['POST'])
def create_order():
    """
    API endpoint for creating an order:
      - validates initData from Telegram Mini App
      - converts cart items to Telegram LabeledPrice[]
      - creates invoice URL via Telegram Payments (YooKassa token)
      - returns invoiceUrl to be opened in Mini App
    """
    request_data = request.get_json(force=True)

    # 1) validate initData
    auth_data = request_data.get('_auth')
    if auth_data is None or not auth.validate_auth_data(bot.BOT_TOKEN, auth_data):
        return { 'message': 'Request data should contain auth data.' }, 401

    # 2) cart
    order_items = request_data.get('cartItems')
    if order_items is None:
        return { 'message': 'Cart Items are not provided.' }, 400

    labeled_prices = []
    total_amount_kopecks = 0

    for order_item in order_items:
        name = order_item['cafeItem']['name']
        variant = order_item['variant']['name']
        cost_rub = int(order_item['variant']['cost'])   # в рублях
        quantity = int(order_item['quantity'])

        amount = cost_rub * quantity * 100              # в копейках!
        total_amount_kopecks += amount

        labeled_prices.append(
            LabeledPrice(
                label=f'{name} ({variant}) x{quantity}',
                amount=amount
            )
        )
       
    # 3) provider token (ЮKassa) обязателен
    provider_token = os.getenv('PAYMENT_PROVIDER_TOKEN')
    if not provider_token:
        return { 'message': 'PAYMENT_PROVIDER_TOKEN is not set on server.' }, 500

    payload = f'order-{total_amount_kopecks}'  # сюда можно подставлять свой order_id

    invoice_url = bot.create_invoice_link(
        title="Заказ в магазине",
        description="Оплата корзины в MiniApp",
        payload=payload,
        provider_token=provider_token,
        currency="RUB",
        prices=labeled_prices
    )

    return { 'ok': True, 'invoiceUrl': invoice_url }, 200


# ==============================
# Helpers
# ==============================
def json_data(data_file_path: str):
    """
    Extracts data from the JSON file.
    """
    if os.path.exists(data_file_path):
        with open(data_file_path, 'r', encoding='utf-8') as data_file:
            return json.load(data_file)
    else:
        raise FileNotFoundError()


# Обновление webhook при старте (оставляем как в шаблоне)
bot.refresh_webhook()
