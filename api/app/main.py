"""Agentic SDLC / Software Factory API (FastAPI).

Wires CORS, correlation IDs, seed users, the central error handler, and all
route modules. Business logic stays in the service layer; the API is the
source of truth for authentication, RBAC, and approval-gate enforcement.
"""
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .errors import ApiError
from .routers import agents, approvals, audit, auth, config as config_router, projects, uploads, users
from .users_service import ensure_seed_users


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_seed_users()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Agentic SDLC API", version="1.0.0", lifespan=lifespan)
    allowed_origins = [
        o.strip()
        for o in os.getenv("API_CORS_ALLOWED_ORIGINS", "http://localhost:8100,http://localhost:4200").split(",")
        if o.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Content-Type", "Authorization", "X-Correlation-ID", "x-correlation-id"],
        expose_headers=["X-Correlation-ID", "x-correlation-id"],
    )

    @app.middleware("http")
    async def add_correlation_id(request: Request, call_next):
        correlation = request.headers.get("x-correlation-id") or str(uuid.uuid4())
        request.state.correlation_id = correlation
        response = await call_next(request)
        response.headers["x-correlation-id"] = correlation
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        return JSONResponse(
            status_code=exc.status,
            content={"error": exc.message, "correlationId": getattr(request.state, "correlation_id", None)},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"error": "Invalid request", "details": exc.errors(), "correlationId": getattr(request.state, "correlation_id", None)},
        )

    @app.get("/api/health", tags=["health"])
    async def health():
        return {"status": "ok", "service": "agentic-sdlc-api"}

    for module in (auth, users, projects, approvals, agents, audit, config_router, uploads):
        app.include_router(module.router)

    return app


app = create_app()