from collections.abc import Sequence

from fastapi import APIRouter, status
from sqlalchemy import select

from app.deps import DbSession, get_or_404, save
from app.models import Job, JobQuestion
from app.schemas import JobCreate, JobQuestionCount, JobRead, JobUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _set_question_counts(job: Job, counts: list[JobQuestionCount]) -> None:
    """Make job.questions match `counts`, updating existing rows in place. Deleting and re-adding a
    type in one commit would break the one-row-per-type rule, because inserts are written first."""
    wanted = {c.type: c.count for c in counts}
    for row in list(job.questions):
        if row.type in wanted:
            row.count = wanted.pop(row.type)
        else:
            job.questions.remove(row)
    job.questions.extend(JobQuestion(type=qtype, count=count) for qtype, count in wanted.items())


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_job(body: JobCreate, db: DbSession) -> Job:
    job = Job(**body.model_dump(exclude={"questions"}))
    _set_question_counts(job, body.questions)
    return save(db, job)


@router.get("", response_model=list[JobRead])
def list_jobs(db: DbSession) -> Sequence[Job]:
    return db.scalars(select(Job).order_by(Job.id)).all()


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, db: DbSession) -> Job:
    return get_or_404(db, Job, job_id)


@router.patch("/{job_id}", response_model=JobRead)
def update_job(job_id: int, body: JobUpdate, db: DbSession) -> Job:
    """Changes apply to resumes uploaded from now on. Candidates who already have questions keep them."""
    job = get_or_404(db, Job, job_id)
    for field, value in body.model_dump(exclude_unset=True, exclude={"questions"}).items():
        setattr(job, field, value)
    if "questions" in body.model_fields_set:
        _set_question_counts(job, body.questions)
    return save(db, job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, db: DbSession) -> None:
    """Also deletes the job's question counts, existing-question files, and candidates with everything generated for them."""
    db.delete(get_or_404(db, Job, job_id))
    db.commit()
