from flask import Flask, request, jsonify
from bot import bot, process_update

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    return "OK", 200

@app.route("/bot", methods=["POST"])
def bot_webhook():
    json_data = request.get_json(force=True, silent=True)
    if json_data:
        process_update(json_data)
    return "OK", 200
