from flask import Flask, request
from bot import bot, process_update

app = Flask(__name__)

@app.route('/', methods=['GET'])
def home():
    return "OK", 200

@app.route('/bot', methods=['POST'])
def bot_webhook():
    json_data = request.get_json()
    process_update(json_data)
    return "OK", 200

@app.route('/refresh_webhook', methods=['GET'])
def refresh_webhook():
    bot.remove_webhook()
    bot.set_webhook(url="https://tma-cafe-backend.onrender.com/bot")
    return "Webhook refreshed", 200

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
