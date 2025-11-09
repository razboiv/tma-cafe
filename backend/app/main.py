from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")


def load_json(path):
    full_path = os.path.join(DATA_DIR, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"{path} not found")

    with open(full_path, "r", encoding="utf-8") as file:
        return json.load(file)


@app.get("/info")
def get_info():
    return load_json("info.json")


@app.get("/categories")
def get_categories():
    return load_json("categories.json")


@app.get("/menu/popular")
def get_popular():
    return load_json("menu/popular.json")
