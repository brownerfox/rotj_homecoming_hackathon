from conftest import CHALLENGE

from app.models import QuestionType


def test_question_types_lists_every_type(client):
    assert [t["value"] for t in client.get("/question-types").json()] == list(QuestionType)


def test_create_list_and_filter_questions(client, job):
    url = f"/jobs/{job['id']}/questions"
    behavioral = client.post(url, json={"type": "behavioral", "text": "Tell me about a conflict.", "rubric": "Ownership."}).json()
    coding = client.post(url, json={"type": "coding", "text": "FizzBuzz", "skills": ["Python"]}).json()

    assert behavioral["job_id"] == job["id"]
    assert behavioral["notes"] is None
    assert client.get(url).json() == [behavioral, coding]
    assert client.get(url, params={"type": "coding"}).json() == [coding]


def test_question_type_must_be_one_the_job_uses(client, job, coding_question):
    # The fixture job allows behavioral and coding only.
    response = client.post(f"/jobs/{job['id']}/questions", json={"type": "system_design", "text": "Design a cache."})
    assert response.status_code == 400
    assert client.patch(f"/questions/{coding_question['id']}", json={"type": "system_design"}).status_code == 400


def test_question_for_missing_job_is_404(client):
    assert client.post("/jobs/999/questions", json={"type": "coding", "text": "x"}).status_code == 404


def test_notes_can_be_set_and_cleared(client, coding_question):
    url = f"/questions/{coding_question['id']}"
    assert client.patch(url, json={"notes": "Ask about recursion."}).json()["notes"] == "Ask about recursion."
    cleared = client.patch(url, json={"notes": None}).json()
    assert cleared["notes"] is None
    assert cleared["text"] == coding_question["text"]


def test_cannot_change_type_while_question_has_a_coding_challenge(client, coding_question):
    client.post(f"/questions/{coding_question['id']}/coding-challenge", json=CHALLENGE)
    response = client.patch(f"/questions/{coding_question['id']}", json={"type": "behavioral"})
    assert response.status_code == 409
