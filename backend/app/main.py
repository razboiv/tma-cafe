@app.route('/order', methods=['POST'])
def create_order():
    request_data = request.get_json(force=True, silent=True) or {}

    # 1) auth
    auth_data = request_data.get('_auth')
    if not auth_data or not auth.validate_auth_data(bot.BOT_TOKEN, auth_data):
        return {'message': 'Invalid auth data'}, 401

    # 2) cart
    order_items = request_data.get('cartItems')
    if not order_items:
        return {'message': 'Cart is empty'}, 400

    labeled_prices = []
    total_kopecks = 0

    for item in order_items:

        cafe = item['cafeItem']     # ✅ меняем cafeteria → cafeItem
        variant = item['variant']
        quantity = int(item['quantity'])

        name = cafe['name']
        variant_name = variant['name']
        cost_rub = int(variant['cost'])

        amount = cost_rub * quantity * 100

        labeled_prices.append(
            LabeledPrice(
                label=f"{name} ({variant_name}) ×{quantity}",
                amount=amount
            )
        )

        total_kopecks += amount

    provider_token = os.getenv('PAYMENT_PROVIDER_TOKEN')
    if not provider_token:
        return {'message': 'PAYMENT_PROVIDER_TOKEN not set'}, 500

    payload = f"order-{total_kopecks}"

    invoice_url = bot.create_invoice_link(
        title="Заказ в магазине",
        description="Оплата корзины в MiniApp",
        payload=payload,
        provider_token=provider_token,
        currency="RUB",
        prices=labeled_prices
    )

    return {'ok': True, 'invoiceUrl': invoice_url}, 200
