from collections.abc import Sequence

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import DbSession, get_or_404, save
from app.models import Job
from app.schemas import JobCreate, JobRead, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_job(body: JobCreate, db: DbSession) -> Job:
    return save(db, Job(**body.model_dump()))


@router.get("", response_model=list[JobRead])
def list_jobs(db: DbSession) -> Sequence[Job]:
    return db.scalars(select(Job).order_by(Job.id)).all()


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, db: DbSession) -> Job:
    return get_or_404(db, Job, job_id)


@router.patch("/{job_id}", response_model=JobRead)
def update_job(job_id: int, body: JobUpdate, db: DbSession) -> Job:
    job = get_or_404(db, Job, job_id)
    changes = body.model_dump(exclude_unset=True)

    if "question_types" in changes:
        still_used = {q.type for q in job.questions} - set(changes["question_types"])
        if still_used:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Questions on this job still use: {', '.join(sorted(still_used))}. "
                "Change or delete those questions first.",
            )

    for field, value in changes.items():
        setattr(job, field, value)
    return save(db, job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, db: DbSession) -> None:
    """Also deletes the job's questions, coding challenges, candidates, and candidate questions."""
    db.delete(get_or_404(db, Job, job_id))
    db.commit()
