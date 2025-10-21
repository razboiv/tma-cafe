import json
import os

from . import auth, bot
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from telebot.types import LabeledPrice

# ──────────────────────────────────────────────────────────────────────────────
# Загружаем .env (на Vercel переменные берутся из Environment Variables)
# ──────────────────────────────────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
# обрабатываем /info и /info/
app.url_map.strict_slashes = True

# ──────────────────────────────────────────────────────────────────────────────
# CORS: разрешаем фронту ходить на бэк
# ──────────────────────────────────────────────────────────────────────────────
allowed_origins = [os.getenv('APP_URL')]
if os.getenv('DEV_MODE'):
    allowed_origins.append(os.getenv('DEV_APP_URL'))
CORS(app, origins=[o for o in allowed_origins if o is not None])

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║ Telegram webhook endpoint                                                ║
# ╚══════════════════════════════════════════════════════════════════════════╝
@app.route(bot.WEBHOOK_PATH, methods=['POST'])
def bot_webhook():
    """
    Точка входа для апдейтов от Telegram.
    Важно: URL вебхука = WEBHOOK_URL + WEBHOOK_PATH (без лишних /bot/bot).
    """
    update_json = request.get_json(force=True)
    bot.process_update(update_json)
    return {'message': 'OK'}, 200


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║ Public API для фронта                                                    ║
# ╚══════════════════════════════════════════════════════════════════════════╝
@app.route('/info')
def info():
    """Информация о кафе."""
    try:
        return json_data('data/info.json')
    except FileNotFoundError:
        return {'message': 'Could not find info data.'}, 404


@app.route('/categories')
def categories():
    """Список категорий."""
    try:
        return json_data('data/categories.json')
    except FileNotFoundError:
        return {'message': 'Could not find categories data.'}, 404


@app.route('/menu/<category_id>')
def category_menu(category_id: str):
    """Меню выбранной категории по её id."""
    try:
        return json_data(f'data/menu/{category_id}.json')
    except FileNotFoundError:
        return {'message': f'Could not find {category_id} category data.'}, 404


@app.route('/menu/details/<menu_item_id>')
def menu_item_details(menu_item_id: str):
    """Детали конкретного товара по его id."""
    try:
        data_folder_path = 'data/menu'
        for data_file in os.listdir(data_folder_path):
            menu_items = json_data(f'{data_folder_path}/{data_file}')
            desired = next((mi for mi in menu_items if mi['id'] == menu_item_id), None)
            if desired is not None:
                return desired
        return {'message': f'Could not find menu item data with {menu_item_id} ID.'}, 404
    except FileNotFoundError:
        return {'message': f'Could not find menu item data with {menu_item_id} ID.'}, 404


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║ Создание заказа + счёта для оплаты (Telegram Payments / провайдер токен)║
# ╚══════════════════════════════════════════════════════════════════════════╝
@app.route('/order', methods=['POST'])
def create_order():
    """
    Принимает корзину из Mini App, валидирует initData, создаёт инвойс-ссылку.
    Ожидаемый body:
    {
      "_auth": "<initData>",
      "cartItems": [
        {
          "cafeItem": {"name": "Burger"},
          "variant": {"name": "Small", "cost": 100},
          "quantity": 2
        }
      ]
    }
    """
    # 0) тело запроса
    request_data = request.get_json(force=True)

    # 1) валидируем initData от мини-приложения
    auth_data = request_data.get('_auth')
    if auth_data is None or not auth.validate_auth_data(bot.BOT_TOKEN, auth_data):
        return {'message': 'Request data should contain auth data.'}, 401

    # 2) корзина
    order_items = request_data.get('cartItems')
    if order_items is None:
        return {'message': 'Cart Items are not provided.'}, 400

    # 3) собираем позиции и сумму
    labeled_prices: list[LabeledPrice] = []
    total_amount_kopecks = 0

    for oi in order_items:
        name = oi['cafeItem']['name']
        variant = oi['variant']['name']
        cost_rub = int(oi['variant']['cost'])       # в рублях
        quantity = int(oi['quantity'])

        amount = cost_rub * quantity * 100          # в копейках
        total_amount_kopecks += amount

        labeled_prices.append(
            LabeledPrice(
                label=f'{name} ({variant}) x{quantity}',
                amount=amount
            )
        )

    # 4) токен платёжного провайдера (ЮKassa/Paymaster)
    provider_token = os.getenv('PAYMENT_PROVIDER_TOKEN')
    if not provider_token:
        return {'message': 'PAYMENT_PROVIDER_TOKEN is not set on server.'}, 500

    # payload можно использовать как свой order_id
    payload = f'order-{total_amount_kopecks}'

    # создаём ссылку на оплату через Bot API
    invoice_url = bot.create_invoice_link(
        title='Заказ в магазине',
        description='Оплата корзины в MiniApp',
        payload=payload,
        provider_token=provider_token,
        currency='RUB',
        prices=labeled_prices
    )

    return {'ok': True, 'invoiceUrl': invoice_url}, 200


# ╔══════════════════════════════════════════════════════════════════════════╗
# ║ Вспомогательное                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════╝
def json_data(data_file_path: str):
    """Читает и возвращает JSON из файла (dict/list)."""
    if os.path.exists(data_file_path):
        with open(data_file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    raise FileNotFoundError()


# обновим вебхук при старте (оставляем как в шаблоне)
bot.refresh_webhook()
