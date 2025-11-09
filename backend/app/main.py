import os
import json
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.join(os.path.dirname(__file__), "data")


def read_json(path):
    full_path = os.path.join(BASE_DIR, path)
    if not os.path.exists(full_path):
        return None
    with open(full_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/info")
def info():
    data = read_json("info.json")
    if data:
        return jsonify(data)
    return jsonify({"message": "info.json not found"}), 404


@app.route("/categories")
def categories():
    data = read_json("categories.json")
    if data:
        return jsonify(data)
    return jsonify({"message": "categories.json not found"}), 404


@app.route("/menu/popular")
def menu_popular():
    data = read_json("menu/popular.json")
    if data:
        return jsonify(data)
    return jsonify({"message": "popular.json not found"}), 404


@app.route("/menu/<item>")
def menu_item(item):
    filename = f"menu/{item}.json"
    data = read_json(filename)
    if data:
        return jsonify(data)
    return jsonify({"message": f'{filename} not found'}), 404


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
