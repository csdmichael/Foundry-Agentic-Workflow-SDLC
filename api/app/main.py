import os
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="Agentic SDLC API", version="1.0.0")
    allowed_origins = [
        origin.strip()
        for origin in os.getenv("API_CORS_ALLOWED_ORIGINS", "http://localhost:8100").split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Content-Type", "Authorization", "X-Correlation-ID"],
        expose_headers=["X-Correlation-ID"],
    )

    @app.middleware("http")
    async def add_correlation_id(request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "agentic-sdlc-api"}

    return app


app = create_app()