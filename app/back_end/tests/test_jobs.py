from conftest import JOB, make_pdf, pdf_files
from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Candidate, CandidateQuestion, CodingChallenge, ExistingQuestionFile, JobQuestion


def test_create_read_and_list_job(client):
    response = client.post("/jobs", json={**JOB, "skills": [" Python ", "python", "SQL"]})
    assert response.status_code == 201
    job = response.json()
    assert job["skills"] == ["Python", "SQL"]  # trimmed, and repeats dropped case-insensitively
    assert job["starter_code"] is True  # the default
    # Sent as technical then behavioral; always returned in question-type order.
    assert job["questions"] == [{"type": "behavioral", "count": 2}, {"type": "technical", "count": 1}]
    assert job["created_at"].endswith("Z")  # timestamps are explicitly UTC
    assert client.get(f"/jobs/{job['id']}").json() == job
    assert client.get("/jobs").json() == [job]


def test_question_types_are_listed_in_display_order(client):
    types = client.get("/question-types").json()
    assert [t["value"] for t in types] == [
        "debugging", "behavioral", "situational", "technical", "system_design", "resume_deep_dive",
        "code_review", "data_modeling", "testing_strategy", "motivation", "leadership",
    ]
    assert all(t["description"] for t in types)


def test_question_counts_are_validated(client):
    duplicate = [{"type": "behavioral", "count": 1}, {"type": "behavioral", "count": 2}]
    assert client.post("/jobs", json={**JOB, "questions": duplicate}).status_code == 422
    assert client.post("/jobs", json={**JOB, "questions": [{"type": "behavioral", "count": 0}]}).status_code == 422
    assert client.post("/jobs", json={**JOB, "questions": [{"type": "behavioral", "count": 11}]}).status_code == 422
    assert client.post("/jobs", json={**JOB, "questions": [{"type": "coding", "count": 1}]}).status_code == 422


def test_patch_replaces_question_counts(client, job):
    # Keeps a type with a new count, adds one, and drops one, all in one request.
    new_counts = [{"type": "behavioral", "count": 3}, {"type": "debugging", "count": 1}]
    response = client.patch(f"/jobs/{job['id']}", json={"questions": new_counts})
    assert response.status_code == 200, response.text
    assert response.json()["questions"] == [new_counts[1], new_counts[0]]  # returned in type order: debugging first
    assert response.json()["title"] == job["title"]


def test_patch_changes_only_the_fields_sent(client, job):
    response = client.patch(f"/jobs/{job['id']}", json={"starter_code": False, "coding_brief": None})
    assert response.json()["starter_code"] is False
    assert response.json()["coding_brief"] is None
    assert response.json()["questions"] == job["questions"]


def test_patch_rejects_null_for_required_field(client, job):
    assert client.patch(f"/jobs/{job['id']}", json={"title": None}).status_code == 422
    assert client.patch(f"/jobs/{job['id']}", json={"starter_code": None}).status_code == 422


def test_missing_job_is_404(client):
    assert client.get("/jobs/999").status_code == 404


def test_deleting_a_job_deletes_everything_under_it(client, job, fake_claude):
    client.post(f"/jobs/{job['id']}/existing-questions", files=pdf_files(("old.pdf", make_pdf("Why us"))))
    client.post(f"/jobs/{job['id']}/candidates", files=pdf_files(("jane.pdf", make_pdf("Jane Doe resume"))))

    assert client.delete(f"/jobs/{job['id']}").status_code == 204

    # Checked in the database itself: proves SQLite is enforcing ON DELETE CASCADE.
    with SessionLocal() as db:
        for model in (JobQuestion, ExistingQuestionFile, Candidate, CandidateQuestion, CodingChallenge):
            assert db.scalar(select(func.count()).select_from(model)) == 0, model.__name__
