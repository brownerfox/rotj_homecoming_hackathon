from conftest import CHALLENGE, JOB
from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Candidate, CandidateQuestion, CodingChallenge, Question


def test_create_read_and_list_job(client):
    response = client.post("/jobs", json={**JOB, "skills": [" Python ", "python", "SQL"]})
    assert response.status_code == 201
    job = response.json()
    assert job["skills"] == ["Python", "SQL"]  # trimmed, and repeats dropped case-insensitively
    assert job["question_types"] == ["behavioral", "coding"]
    assert job["created_at"].endswith("Z")  # timestamps are explicitly UTC
    assert client.get(f"/jobs/{job['id']}").json() == job
    assert client.get("/jobs").json() == [job]


def test_job_needs_at_least_one_known_question_type(client):
    assert client.post("/jobs", json={**JOB, "question_types": []}).status_code == 422
    assert client.post("/jobs", json={**JOB, "question_types": ["trivia"]}).status_code == 422


def test_patch_changes_only_the_fields_sent(client, job):
    response = client.patch(f"/jobs/{job['id']}", json={"title": "Staff Engineer"})
    assert response.status_code == 200
    assert response.json()["title"] == "Staff Engineer"
    assert response.json()["context"] == job["context"]


def test_patch_rejects_null_for_required_field(client, job):
    assert client.patch(f"/jobs/{job['id']}", json={"title": None}).status_code == 422


def test_cannot_remove_a_question_type_that_questions_still_use(client, job, coding_question):
    response = client.patch(f"/jobs/{job['id']}", json={"question_types": ["behavioral"]})
    assert response.status_code == 409
    assert "coding" in response.json()["detail"]


def test_missing_job_is_404(client):
    assert client.get("/jobs/999").status_code == 404


def test_deleting_a_job_deletes_everything_under_it(client, job, coding_question, candidate):
    client.post(f"/questions/{coding_question['id']}/coding-challenge", json=CHALLENGE)
    client.post(f"/candidates/{candidate['id']}/questions", json={"question_id": coding_question["id"]})

    assert client.delete(f"/jobs/{job['id']}").status_code == 204

    # Checked in the database itself: proves SQLite is enforcing ON DELETE CASCADE.
    with SessionLocal() as db:
        for model in (Question, CodingChallenge, Candidate, CandidateQuestion):
            assert db.scalar(select(func.count()).select_from(model)) == 0, model.__name__
