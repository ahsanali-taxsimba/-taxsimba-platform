"""FastAPI entrypoint for SIMBA AI (TaxSimba AI Tax Concierge V2)."""

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
from app.api.routes import analytics, catalog, chat, health, journeys, sessions
from app.core.config import Settings, get_settings
from app.core.errors import ConciergeError
from app.sessions.store import session_store

logger = logging.getLogger(__name__)

WIDGET_DIR = Path(__file__).resolve().parents[2] / "widget"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        path = request.url.path
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
        analytics_recorder = AnalyticsRecorder()
        app.state.settings = settings
        app.state.llm = llm
        app.state.stubs = build_stub_adapters(settings)
        app.state.analytics = analytics_recorder
        app.state.sessions = session_store
        app.state.engine = ConversationalEngine(
            llm=llm,
            analytics=analytics_recorder,
            settings=settings,
            sessions=session_store,
        )
        logger.info(
            "SIMBA AI started (version=%s llm_mode=%s)",
            __version__,
            llm.mode,
        )
        yield

    app = FastAPI(
        title="SIMBA AI — TaxSimba UK Tax Assistant",
        version=__version__,
        description="Standalone SIMBA AI concierge — isolated from portal/taxotools",
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

    prefix = "/api/v1"
    app.include_router(health.router, prefix=prefix)
    app.include_router(chat.router, prefix=prefix)
    app.include_router(journeys.router, prefix=prefix)
    app.include_router(catalog.router, prefix=prefix)
    app.include_router(sessions.router, prefix=prefix)
    app.include_router(analytics.router, prefix=prefix)

    if WIDGET_DIR.is_dir():
        app.mount("/widget", StaticFiles(directory=str(WIDGET_DIR), html=True), name="widget")

    @app.get("/")
    async def root():
        return {
            "product": "SIMBA AI",
            "subtitle": "Your UK Tax Assistant",
            "phase": "master-completion",
            "version": __version__,
            "preview": "/widget/preview.html",
            "embed": "/widget/embed.js",
            "docs": "/docs",
            "handover_docs": "ai-tax-concierge-v2/docs/toxel/",
        }

    return app


app = create_app()
