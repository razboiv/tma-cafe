from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.app import router as api_router   # твой правильный путь
import uvicorn

app = FastAPI()

# Разрешаем CORS для фронтенда (мини-приложения Telegram)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роуты API
app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    return {"status": "ok", "message": "Backend is running"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
