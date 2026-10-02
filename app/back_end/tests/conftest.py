import os

# Must run before `app` is imported (settings are read at import time). These are hard overrides,
# not setdefault, so tests never touch a real database named in the environment or .env.
os.environ["DATABASE_URL"] = "sqlite://"
# The in-memory test database is one shared connection, so generation must run one candidate at a time.
os.environ["GENERATION_CONCURRENCY"] = "1"

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import ai
from app.database import Base, engine
from app.main import app

# The real client factory without its cache, kept before the fixtures below replace it.
REAL_GET_CLIENT = ai.get_client.__wrapped__

JOB = {
    "title": "Backend Engineer",
    "description": "Owns the public REST API.",
    "skills": ["Python", "SQL"],
    "coding_brief": "Something about parsing log files.",
    "questions": [{"type": "technical", "count": 1}, {"type": "behavioral", "count": 2}],
}


def make_pdf(text: str | None) -> bytes:
    """A one-page PDF. With text=None the page has no text layer, like a scanned image."""
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode() if text else b""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    xref = len(pdf)
    pdf += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    pdf += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(pdf)


def pdf_files(*named_pdfs: tuple[str, bytes]) -> list:
    """Multipart `files` for TestClient uploads."""
    return [("files", (name, data, "application/pdf")) for name, data in named_pdfs]


def _fill(schema: dict, key: str = ""):
    """A value matching a structured-output schema: "Generated <key>" for each string."""
    if schema["type"] == "object":
        return {name: _fill(sub, name) for name, sub in schema["properties"].items()}
    return "Jane Doe" if key == "candidate_name" else f"Generated {key}"


class FakeClaude:
    """Stands in for anthropic.Anthropic. Answers every request with JSON shaped by the request's own
    schema and records what was sent, so tests cover prompt building and parsing with no API calls."""

    def __init__(self):
        self.requests: list[dict] = []
        self.stop_reason = "end_turn"
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, **request):
        self.requests.append(request)
        output_format = request["output_config"].get("format")
        text = json.dumps(_fill(output_format["schema"])) if output_format else "Transcribed resume of Sam Scan"
        usage = SimpleNamespace(input_tokens=900, output_tokens=400, cache_creation_input_tokens=0, cache_read_input_tokens=0)
        return SimpleNamespace(stop_reason=self.stop_reason, content=[SimpleNamespace(type="text", text=text)], usage=usage)


@pytest.fixture(autouse=True)
def no_real_claude(monkeypatch):
    def refuse():
        raise AssertionError("Tests must not call the real Claude API. Use the fake_claude fixture.")

    monkeypatch.setattr(ai, "get_client", refuse)


@pytest.fixture
def fake_claude(monkeypatch) -> FakeClaude:
    fake = FakeClaude()
    monkeypatch.setattr(ai, "get_client", lambda: fake)
    return fake


@pytest.fixture
def client():
    # `with` runs the app's startup, which creates the tables. Background tasks finish before each
    # TestClient call returns, so generation is complete by the time a test checks the result.
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(engine)


@pytest.fixture
def job(client) -> dict:
    response = client.post("/jobs", json=JOB)
    assert response.status_code == 201, response.text
    return response.json()
