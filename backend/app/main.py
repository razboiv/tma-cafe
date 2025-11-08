from flask import Flask, request, jsonify
from flask_cors import CORS
import auth

app = Flask(__name__)
CORS(app)

@app.route("/api/info", methods=["POST"])
def info():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Request must be a JSON object"}), 400

    user = auth.check_auth(data.get("_auth"))
    return jsonify({"status": "ok", "user": user})

@app.route("/api/categories", methods=["POST"])
def categories():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Request must be a JSON object"}), 400

    return jsonify({
        "categories": [
            {"id": 1, "name": "Burgers"},
            {"id": 2, "name": "Pizza"},
            {"id": 3, "name": "Drinks"}
        ]
    })

@app.route("/api/cart", methods=["POST"])
def cart():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"message": "Request must be a JSON object"}), 400

    return jsonify({"ok": True, "cart": data.get("cartItems", [])})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
