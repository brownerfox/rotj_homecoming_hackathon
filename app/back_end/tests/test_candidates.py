from conftest import JOB


def test_candidate_crud(client, job, candidate):
    assert candidate["job_id"] == job["id"]
    assert client.get(f"/jobs/{job['id']}/candidates").json() == [candidate]
    assert client.get("/candidates").json() == [candidate]

    updated = client.patch(f"/candidates/{candidate['id']}", json={"resume_text": "Also writes Rust."}).json()
    assert updated["resume_text"] == "Also writes Rust."
    assert updated["name"] == candidate["name"]

    assert client.delete(f"/candidates/{candidate['id']}").status_code == 204
    assert client.get("/candidates").json() == []


def test_assign_and_list_candidate_questions(client, candidate, coding_question):
    url = f"/candidates/{candidate['id']}/questions"
    response = client.post(url, json={"question_id": coding_question["id"], "rationale": "Resume mentions linked lists."})
    assert response.status_code == 201

    [assignment] = client.get(url).json()
    assert assignment["rationale"] == "Resume mentions linked lists."
    assert assignment["question"] == coding_question  # the full question is embedded

    patched = client.patch(f"{url}/{coding_question['id']}", json={"rationale": "Probe the Kafka work too."})
    assert patched.json()["rationale"] == "Probe the Kafka work too."


def test_a_question_is_assigned_to_a_candidate_at_most_once(client, candidate, coding_question):
    url = f"/candidates/{candidate['id']}/questions"
    assert client.post(url, json={"question_id": coding_question["id"]}).status_code == 201
    assert client.post(url, json={"question_id": coding_question["id"]}).status_code == 409


def test_cannot_assign_a_question_from_another_job(client, candidate):
    other_job = client.post("/jobs", json=JOB).json()
    question = client.post(f"/jobs/{other_job['id']}/questions", json={"type": "coding", "text": "x"}).json()
    response = client.post(f"/candidates/{candidate['id']}/questions", json={"question_id": question["id"]})
    assert response.status_code == 400


def test_unassigning_keeps_the_question(client, candidate, coding_question):
    url = f"/candidates/{candidate['id']}/questions"
    client.post(url, json={"question_id": coding_question["id"]})

    assert client.delete(f"{url}/{coding_question['id']}").status_code == 204
    assert client.get(url).json() == []
    assert client.get(f"/questions/{coding_question['id']}").status_code == 200


def test_deleting_a_question_removes_its_assignments(client, candidate, coding_question):
    url = f"/candidates/{candidate['id']}/questions"
    client.post(url, json={"question_id": coding_question["id"]})

    client.delete(f"/questions/{coding_question['id']}")
    assert client.get(url).json() == []
