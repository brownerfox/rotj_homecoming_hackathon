from conftest import CHALLENGE


def test_coding_challenge_crud(client, coding_question):
    url = f"/questions/{coding_question['id']}/coding-challenge"

    created = client.post(url, json=CHALLENGE)
    assert created.status_code == 201
    assert created.json()["skeleton_code"] == CHALLENGE["skeleton_code"]  # whitespace kept exactly
    assert client.get(url).json() == created.json()

    patched = client.patch(url, json={"reference_solution": "def solve():\n    return 6 * 7\n"})
    assert patched.json()["reference_solution"] == "def solve():\n    return 6 * 7\n"
    assert patched.json()["test_code"] == CHALLENGE["test_code"]

    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


def test_only_coding_questions_can_have_a_challenge(client, job):
    question = client.post(f"/jobs/{job['id']}/questions", json={"type": "behavioral", "text": "Why us?"}).json()
    assert client.post(f"/questions/{question['id']}/coding-challenge", json=CHALLENGE).status_code == 400


def test_a_question_has_at_most_one_challenge(client, coding_question):
    url = f"/questions/{coding_question['id']}/coding-challenge"
    assert client.post(url, json=CHALLENGE).status_code == 201
    assert client.post(url, json=CHALLENGE).status_code == 409


def test_blank_code_is_rejected(client, coding_question):
    url = f"/questions/{coding_question['id']}/coding-challenge"
    assert client.post(url, json={**CHALLENGE, "test_code": "   \n"}).status_code == 422
    assert client.post(url, json={**CHALLENGE, "language": "cobol"}).status_code == 422
