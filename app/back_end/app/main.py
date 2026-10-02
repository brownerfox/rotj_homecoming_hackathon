from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import candidate_questions, candidates, coding_challenges, jobs, questions


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Hackathon shortcut: create any missing tables on startup. create_all never alters a table
    # that already exists, so after changing a model either delete calibrate.db or move to Alembic.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Calibrate API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (jobs, questions, coding_challenges, candidates, candidate_questions):
    app.include_router(module.router)
