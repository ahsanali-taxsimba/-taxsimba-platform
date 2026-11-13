"""FastAPI entrypoint for TaxSimba AI Tax Concierge V2."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app import __version__
from app.adapters.factory import build_llm_adapter, build_stub_adapters
from app.ai.conversational_engine import ConversationalEngine
from app.analytics.events import AnalyticsRecorder
from app.api.routes import catalog, chat, health, journeys
from app.core.config import Settings, get_settings
from app.core.errors import ConciergeError

logger = logging.getLogger(__name__)

WIDGET_DIR = Path(__file__).resolve().parents[2] / "widget"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        path = request.url.path
        # Widget must be iframe-embeddable on host sites without altering their design.
        if path.startswith("/widget"):
            response.headers["Content-Security-Policy"] = "frame-ancestors *"
        else:
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logging.basicConfig(level=getattr(logging, settings.concierge_log_level.upper(), logging.INFO))
        llm = build_llm_adapter(settings)
        analytics = AnalyticsRecorder()
        app.state.settings = settings
        app.state.llm = llm
        app.state.stubs = build_stub_adapters(settings)
        app.state.analytics = analytics
        app.state.engine = ConversationalEngine(llm=llm, analytics=analytics, settings=settings)
        logger.info(
            "Tax Concierge V2 started (version=%s phase=2 llm_mode=%s)",
            __version__,
            llm.mode,
        )
        yield

    app = FastAPI(
        title="TaxSimba AI Tax Concierge V2",
        version=__version__,
        description="Standalone UK tax assistant — Phase 2 (chat UI + journeys)",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )
    app.add_middleware(SecurityHeadersMiddleware)

    @app.exception_handler(ConciergeError)
    async def concierge_error_handler(_request: Request, exc: ConciergeError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        )

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(journeys.router, prefix="/api/v1")
    app.include_router(catalog.router, prefix="/api/v1")

    if WIDGET_DIR.is_dir():
        app.mount("/widget", StaticFiles(directory=str(WIDGET_DIR), html=True), name="widget")

    @app.get("/")
    async def root():
        return {
            "product": "TaxSimba AI Tax Concierge V2",
            "phase": 2,
            "version": __version__,
            "preview": "/widget/preview.html",
            "embed": "/widget/embed.js",
            "docs": "/docs",
        }

    return app


app = create_app()
