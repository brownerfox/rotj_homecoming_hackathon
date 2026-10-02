import os

# Must run before `app` is imported (settings are read at import time). This is a hard override,
# not setdefault, so tests can never drop tables in a real database named in the environment or .env.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app

JOB = {
    "title": "Backend Engineer",
    "context": "Owns the public REST API.",
    "skills": ["Python", "SQL"],
    "question_types": ["behavioral", "coding"],
}

CHALLENGE = {
    "language": "python",
    "skeleton_code": "def solve():\n    raise NotImplementedError\n",
    "test_code": "from solution import solve\n\n\ndef test_solve():\n    assert solve() == 42\n",
    "reference_solution": "def solve():\n    return 42\n",
}


@pytest.fixture
def client():
    with TestClient(app) as test_client:  # `with` runs the app's startup, which creates the tables
        yield test_client
    Base.metadata.drop_all(engine)


def _created(response) -> dict:
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def job(client) -> dict:
    return _created(client.post("/jobs", json=JOB))


@pytest.fixture
def coding_question(client, job) -> dict:
    return _created(client.post(f"/jobs/{job['id']}/questions", json={"type": "coding", "text": "Reverse a linked list."}))


@pytest.fixture
def candidate(client, job) -> dict:
    return _created(client.post(f"/jobs/{job['id']}/candidates", json={"name": "Sam Lee", "resume_text": "Built a Kafka pipeline."}))
