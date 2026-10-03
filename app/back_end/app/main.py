import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.generation import fail_interrupted
from app.routers import candidates, existing_questions, jobs, question_types

# Shows this app's INFO logs, including each Claude call's token use and estimated cost.
logging.basicConfig(level=logging.INFO, format="%(levelname)-9s %(name)s: %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Hackathon shortcut: create any missing tables on startup. create_all never alters a table
    # that already exists, so after changing a model run `python -m app.seed --reset` (or move to Alembic).
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        fail_interrupted(db)
    if not settings.api_key:
        log.warning("ANTHROPIC_API_KEY isn't set: everything works except generation and reading scanned PDFs.")
    yield


app = FastAPI(title="Calibrate API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (jobs, question_types, existing_questions, candidates):
    app.include_router(module.router)
