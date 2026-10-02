from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app import ai, generation, pdf_text
from app.deps import DbSession, get_or_404, read_pdf_uploads, save
from app.models import Candidate, CandidateQuestion, CandidateStatus, CodingChallenge, Job
from app.schemas import (
    CandidateDetail,
    CandidateQuestionRead,
    CandidateQuestionUpdate,
    CandidateSummary,
    CandidateUpdate,
    CodingChallengeRead,
    CodingChallengeUpdate,
)

router = APIRouter(tags=["candidates"])


@router.post("/jobs/{job_id}/candidates", response_model=list[CandidateSummary], status_code=status.HTTP_202_ACCEPTED)
def upload_resumes(
    job_id: int,
    files: Annotated[list[UploadFile], File(description="One or more resume PDFs")],
    background: BackgroundTasks,
    db: DbSession,
) -> list[Candidate]:
    """Creates one candidate per resume, then generates each one's questions and coding challenge in
    the background using the job's settings as they are now. Poll GET /jobs/{job_id}/candidates until
    every status is `ready` or `failed`."""
    job = get_or_404(db, Job, job_id)
    snapshot = ai.JobSnapshot.of(job)
    candidates: list[Candidate] = []
    work: list[tuple[Candidate, bytes | None]] = []
    for name, data in read_pdf_uploads(files):
        candidate = Candidate(job=job, resume_file_name=name)
        candidates.append(candidate)
        try:
            text = pdf_text.read_text_layer(data)
        except pdf_text.UnreadablePDF:
            candidate.status = CandidateStatus.FAILED
            candidate.error = "This file isn't a readable PDF. Delete the candidate and upload a different file."
            continue
        candidate.resume_text = text or None
        # A scanned resume has no text layer; its bytes go along so Claude can transcribe it.
        work.append((candidate, None if text else data))

    db.add_all(candidates)
    db.commit()
    if work:
        background.add_task(generation.generate_for_candidates, snapshot, [(c.id, pdf) for c, pdf in work])
    return candidates


@router.get("/jobs/{job_id}/candidates", response_model=list[CandidateSummary])
def list_job_candidates(job_id: int, db: DbSession) -> Sequence[Candidate]:
    get_or_404(db, Job, job_id)
    return db.scalars(select(Candidate).where(Candidate.job_id == job_id).order_by(Candidate.id)).all()


@router.get("/candidates", response_model=list[CandidateSummary])
def list_all_candidates(db: DbSession) -> Sequence[Candidate]:
    """Every candidate across all jobs (for the frontend's Candidates page)."""
    return db.scalars(select(Candidate).order_by(Candidate.id)).all()


@router.get("/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: int, db: DbSession) -> Candidate:
    """The candidate with their resume text, questions (ordered by type), and coding challenge."""
    return get_or_404(db, Candidate, candidate_id)


@router.patch("/candidates/{candidate_id}", response_model=CandidateDetail)
def update_candidate(candidate_id: int, body: CandidateUpdate, db: DbSession) -> Candidate:
    """Fix the name if Claude read it wrong or the resume didn't have one."""
    candidate = get_or_404(db, Candidate, candidate_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    return save(db, candidate)


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(candidate_id: int, db: DbSession) -> None:
    db.delete(get_or_404(db, Candidate, candidate_id))
    db.commit()


@router.post("/candidates/{candidate_id}/retry", response_model=CandidateSummary, status_code=status.HTTP_202_ACCEPTED)
def retry_generation(candidate_id: int, background: BackgroundTasks, db: DbSession) -> Candidate:
    """Run generation again for a failed candidate, using the job's current settings."""
    candidate = get_or_404(db, Candidate, candidate_id)
    if candidate.status != CandidateStatus.FAILED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only candidates whose generation failed can be retried.")
    if candidate.resume_text is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "There's no resume text to work from. Delete the candidate and upload the PDF again."
        )
    candidate.status = CandidateStatus.PENDING
    candidate.error = None
    db.commit()
    background.add_task(generation.generate_for_candidates, ai.JobSnapshot.of(candidate.job), [(candidate.id, None)])
    return candidate


@router.patch("/candidate-questions/{question_id}", response_model=CandidateQuestionRead)
def edit_candidate_question(question_id: int, body: CandidateQuestionUpdate, db: DbSession) -> CandidateQuestion:
    question = get_or_404(db, CandidateQuestion, question_id)
    question.prompt = body.prompt
    return save(db, question)


@router.patch("/candidates/{candidate_id}/coding-challenge", response_model=CodingChallengeRead)
def edit_coding_challenge(candidate_id: int, body: CodingChallengeUpdate, db: DbSession) -> CodingChallenge:
    challenge = get_or_404(db, Candidate, candidate_id).coding_challenge
    if challenge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Candidate {candidate_id} has no coding challenge yet")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(challenge, field, value)
    if (challenge.starter_code is None) != (challenge.tests is None):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Starter code and tests go together: set both or clear both.")
    return save(db, challenge)
