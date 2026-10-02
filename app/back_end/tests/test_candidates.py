from conftest import REAL_GET_CLIENT, make_pdf, pdf_files
from fastapi.testclient import TestClient

from app import ai
from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import Candidate, CandidateStatus


def upload(client, job, *named_pdfs):
    response = client.post(f"/jobs/{job['id']}/candidates", files=pdf_files(*named_pdfs))
    assert response.status_code == 202, response.text
    return response.json()


def test_bulk_upload_creates_and_generates_each_candidate(client, job, fake_claude):
    created = upload(client, job, ("jane.pdf", make_pdf("Jane Doe, Python developer")), ("raj.pdf", make_pdf("Raj, SQL")))
    assert [c["status"] for c in created] == ["pending", "pending"]  # generation runs after the response
    assert len(fake_claude.requests) == 2

    listed = client.get(f"/jobs/{job['id']}/candidates").json()
    assert [c["status"] for c in listed] == ["ready", "ready"]

    jane = client.get(f"/candidates/{created[0]['id']}").json()
    assert jane["name"] == "Jane Doe"
    assert jane["resume_file_name"] == "jane.pdf"
    assert jane["resume_text"] == "Jane Doe, Python developer"
    # One question per count, ordered by type (the job lists technical before behavioral).
    assert [(q["type"], q["prompt"]) for q in jane["questions"]] == [
        ("behavioral", "Generated behavioral_1"),
        ("behavioral", "Generated behavioral_2"),
        ("technical", "Generated technical_1"),
    ]
    challenge = jane["coding_challenge"]
    assert challenge["language"] == "python"
    assert challenge["starter_code"] == "Generated starter_code"
    assert challenge["tests"] == "Generated tests"
    assert challenge["solution_code"] == "Generated solution_code"


def test_request_caches_job_context_and_keeps_resume_separate(client, job, fake_claude):
    client.post(f"/jobs/{job['id']}/existing-questions", files=pdf_files(("old.pdf", make_pdf("Why this company"))))
    upload(client, job, ("jane.pdf", make_pdf("Jane Doe resume")))

    [request] = fake_claude.requests
    instructions, job_context = request["system"]
    assert "cache_control" not in instructions and job_context["cache_control"] == {"type": "ephemeral"}
    for expected in ("Backend Engineer", "Owns the public REST API.", "Python, SQL", "parsing log files", "Why this company"):
        assert expected in job_context["text"]
    assert "Jane Doe resume" in request["messages"][0]["content"]
    assert "Jane Doe" not in job_context["text"]  # the cached part is identical for every resume
    assert request["model"] == settings.claude_model
    assert request["fallbacks"] == "default"


def test_no_starter_code_means_no_starter_code_or_tests(client, job, fake_claude):
    client.patch(f"/jobs/{job['id']}", json={"starter_code": False})
    [created] = upload(client, job, ("jane.pdf", make_pdf("Jane Doe resume")))

    schema = fake_claude.requests[0]["output_config"]["format"]["schema"]
    assert list(schema["properties"]["coding_challenge"]["properties"]) == ["prompt", "solution_code"]
    challenge = client.get(f"/candidates/{created['id']}").json()["coding_challenge"]
    assert challenge["starter_code"] is None and challenge["tests"] is None


def test_job_edits_never_change_existing_candidates(client, job, fake_claude):
    [created] = upload(client, job, ("jane.pdf", make_pdf("Jane Doe resume")))
    before = client.get(f"/candidates/{created['id']}").json()

    client.patch(f"/jobs/{job['id']}", json={"questions": [{"type": "debugging", "count": 1}], "starter_code": False})

    assert client.get(f"/candidates/{created['id']}").json() == before


def test_questions_and_coding_challenge_can_be_edited_by_hand(client, job, fake_claude):
    [created] = upload(client, job, ("jane.pdf", make_pdf("Jane Doe resume")))
    url = f"/candidates/{created['id']}"
    question = client.get(url).json()["questions"][0]

    edited = client.patch(f"/candidate-questions/{question['id']}", json={"prompt": "  Tell me about your Kafka work.  "})
    assert edited.json()["prompt"] == "Tell me about your Kafka work."
    assert client.get(url).json()["questions"][0]["prompt"] == "Tell me about your Kafka work."

    new_tests = "from solution import parse\n\n\ndef test_parse():\n    assert parse('') == []\n"
    response = client.patch(f"{url}/coding-challenge", json={"tests": new_tests})
    assert response.json()["tests"] == new_tests  # whitespace kept exactly
    assert response.json()["prompt"] == "Generated prompt"

    assert client.patch(f"{url}/coding-challenge", json={"tests": None}).status_code == 400  # starter code would lose its tests
    cleared = client.patch(f"{url}/coding-challenge", json={"tests": None, "starter_code": None})
    assert cleared.status_code == 200
    assert client.patch(url, json={"name": "Jane Q. Doe"}).json()["name"] == "Jane Q. Doe"


def test_scanned_resume_is_transcribed_then_generated(client, job, fake_claude):
    [created] = upload(client, job, ("scan.pdf", make_pdf(None)))
    candidate = client.get(f"/candidates/{created['id']}").json()
    assert candidate["status"] == "ready"
    assert candidate["resume_text"] == "Transcribed resume of Sam Scan"
    assert len(fake_claude.requests) == 2  # transcribe, then generate


def test_unreadable_resume_fails_without_calling_claude(client, job, fake_claude):
    [created] = upload(client, job, ("broken.pdf", b"%PDF-1.4 not really a pdf"))
    assert created["status"] == "failed"
    assert "isn't a readable PDF" in created["error"]
    assert fake_claude.requests == []


def test_non_pdf_upload_is_rejected_before_anything_is_created(client, job, fake_claude):
    files = pdf_files(("jane.pdf", make_pdf("Jane"))) + [("files", ("resume.docx", b"x", "application/octet-stream"))]
    response = client.post(f"/jobs/{job['id']}/candidates", files=files)
    assert response.status_code == 400
    assert "resume.docx isn't a PDF" in response.json()["detail"]
    assert client.get(f"/jobs/{job['id']}/candidates").json() == []


def test_failed_generation_can_be_retried(client, job, fake_claude):
    fake_claude.stop_reason = "refusal"
    [created] = upload(client, job, ("jane.pdf", make_pdf("Jane Doe resume")))
    failed = client.get(f"/candidates/{created['id']}").json()
    assert failed["status"] == "failed"
    assert failed["error"] == "Claude declined to process this resume."
    assert failed["questions"] == []

    fake_claude.stop_reason = "end_turn"
    assert client.post(f"/candidates/{created['id']}/retry").status_code == 202
    assert client.get(f"/candidates/{created['id']}").json()["status"] == "ready"
    assert client.post(f"/candidates/{created['id']}/retry").status_code == 409  # only failed candidates


def test_missing_api_key_fails_with_a_clear_message(client, job, monkeypatch):
    monkeypatch.setattr(ai, "get_client", REAL_GET_CLIENT)
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    [created] = upload(client, job, ("jane.pdf", make_pdf("Jane Doe resume")))
    candidate = client.get(f"/candidates/{created['id']}").json()
    assert candidate["status"] == "failed"
    assert "ANTHROPIC_API_KEY isn't set" in candidate["error"]


def test_restart_marks_unfinished_generation_as_failed(client, job):
    with SessionLocal() as db:
        db.add(Candidate(job_id=job["id"], resume_file_name="cut_off.pdf", resume_text="x", status=CandidateStatus.GENERATING))
        db.commit()
    with TestClient(app):  # runs the app's startup again, as a server restart would
        pass
    [candidate] = client.get(f"/jobs/{job['id']}/candidates").json()
    assert candidate["status"] == "failed"
    assert "interrupted" in candidate["error"]


def test_missing_candidate_is_404(client):
    assert client.get("/candidates/999").status_code == 404
    assert client.patch("/candidates/999/coding-challenge", json={}).status_code == 404
    assert client.post("/candidates/999/retry").status_code == 404
