from collections.abc import Sequence

from fastapi import APIRouter, status
from sqlalchemy import select

from app.deps import DbSession, get_or_404, save
from app.models import Candidate, Job
from app.schemas import CandidateCreate, CandidateRead, CandidateUpdate

router = APIRouter(tags=["candidates"])


@router.post("/jobs/{job_id}/candidates", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
def create_candidate(job_id: int, body: CandidateCreate, db: DbSession) -> Candidate:
    job = get_or_404(db, Job, job_id)
    return save(db, Candidate(job=job, **body.model_dump()))


@router.get("/jobs/{job_id}/candidates", response_model=list[CandidateRead])
def list_job_candidates(job_id: int, db: DbSession) -> Sequence[Candidate]:
    get_or_404(db, Job, job_id)
    return db.scalars(select(Candidate).where(Candidate.job_id == job_id).order_by(Candidate.id)).all()


@router.get("/candidates", response_model=list[CandidateRead])
def list_all_candidates(db: DbSession) -> Sequence[Candidate]:
    """Every candidate across all jobs (for the frontend's Candidates page)."""
    return db.scalars(select(Candidate).order_by(Candidate.id)).all()


@router.get("/candidates/{candidate_id}", response_model=CandidateRead)
def get_candidate(candidate_id: int, db: DbSession) -> Candidate:
    return get_or_404(db, Candidate, candidate_id)


@router.patch("/candidates/{candidate_id}", response_model=CandidateRead)
def update_candidate(candidate_id: int, body: CandidateUpdate, db: DbSession) -> Candidate:
    candidate = get_or_404(db, Candidate, candidate_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    return save(db, candidate)


@router.delete("/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(candidate_id: int, db: DbSession) -> None:
    """Also removes the candidate's question assignments (the questions themselves stay)."""
    db.delete(get_or_404(db, Candidate, candidate_id))
    db.commit()
