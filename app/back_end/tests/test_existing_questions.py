from conftest import make_pdf, pdf_files


def test_upload_list_and_remove_existing_question_pdfs(client, job):
    url = f"/jobs/{job['id']}/existing-questions"
    response = client.post(url, files=pdf_files(("round1.pdf", make_pdf("Why do you want this job")), ("round2.pdf", make_pdf("Describe a hard bug"))))
    assert response.status_code == 201, response.text
    first, second = response.json()
    assert (first["file_name"], first["text"]) == ("round1.pdf", "Why do you want this job")
    assert second["text"] == "Describe a hard bug"

    assert client.delete(f"{url}/{first['id']}").status_code == 204
    assert [f["file_name"] for f in client.get(url).json()] == ["round2.pdf"]


def test_a_job_needs_no_existing_questions(client, job):
    assert client.get(f"/jobs/{job['id']}/existing-questions").json() == []


def test_non_pdf_and_corrupt_uploads_are_rejected(client, job):
    url = f"/jobs/{job['id']}/existing-questions"
    assert client.post(url, files=[("files", ("notes.txt", b"hello", "text/plain"))]).status_code == 400
    assert client.post(url, files=pdf_files(("broken.pdf", b"%PDF-1.4 this is not really a pdf"))).status_code == 400
    assert client.get(url).json() == []  # nothing saved


def test_scanned_pdf_is_transcribed_by_claude(client, job, fake_claude):
    response = client.post(f"/jobs/{job['id']}/existing-questions", files=pdf_files(("scan.pdf", make_pdf(None))))
    assert response.status_code == 201
    assert response.json()[0]["text"] == "Transcribed resume of Sam Scan"
    [request] = fake_claude.requests
    assert request["messages"][0]["content"][0]["type"] == "document"


def test_removing_a_file_from_another_job_is_404(client, job):
    other = client.post("/jobs", json={"title": "Other", "description": "x"}).json()
    [uploaded] = client.post(f"/jobs/{job['id']}/existing-questions", files=pdf_files(("a.pdf", make_pdf("Q")))).json()
    assert client.delete(f"/jobs/{other['id']}/existing-questions/{uploaded['id']}").status_code == 404
