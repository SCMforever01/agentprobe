from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from agentprobe.config import Config
from agentprobe.storage.database import Database

from .router import router


def create_app(config: Config, db: Database) -> FastAPI:
    app = FastAPI(title="AgentProbe", version="0.1.0")

    app.state.config = config
    app.state.db = db

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    if config.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=str(config.static_dir), html=True), name="static")

    return app
