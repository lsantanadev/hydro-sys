import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import router


def _cors_origins() -> list[str]:
    origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
    return origins or ["*"]


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
CORS_ORIGINS = _cors_origins()
if APP_ENV in {"production", "prod"} and "*" in CORS_ORIGINS:
    raise RuntimeError("Em producao, configure CORS_ORIGINS com a URL publica do frontend.")
if APP_ENV in {"production", "prod"} and not os.getenv("JWT_SECRET_KEY", "").strip():
    raise RuntimeError("Em producao, configure JWT_SECRET_KEY com um segredo forte.")


app = FastAPI(
    title="HydroSys API",
    description="API MVP online para sensores ESP32, mapa, moradores e auditoria.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
