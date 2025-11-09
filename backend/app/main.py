from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Правильная конфигурация CORS без regex ошибок
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Backend is running!"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
