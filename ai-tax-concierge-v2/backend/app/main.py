"""FastAPI entrypoint for TaxSimba AI Tax Concierge V2."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.adapters.factory import build_llm_adapter, build_stub_adapters
from app.ai.conversational_engine import ConversationalEngine
from app.analytics.events import AnalyticsRecorder
from app.api.routes import chat, health
from app.core.config import Settings, get_settings
from app.core.errors import ConciergeError

logger = logging.getLogger(__name__)


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
        app.state.engine = ConversationalEngine(llm=llm, analytics=analytics)
        logger.info(
            "Tax Concierge V2 started (version=%s llm_mode=%s)",
            __version__,
            llm.mode,
        )
        yield

    app = FastAPI(
        title="TaxSimba AI Tax Concierge V2",
        version=__version__,
        description="Standalone UK tax assistant — Phase 1 backend",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @app.exception_handler(ConciergeError)
    async def concierge_error_handler(_request: Request, exc: ConciergeError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
        )

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")

    @app.get("/")
    async def root():
        return {
            "product": "TaxSimba AI Tax Concierge V2",
            "phase": 1,
            "version": __version__,
            "docs": "/docs",
        }

    return app


app = create_app()
