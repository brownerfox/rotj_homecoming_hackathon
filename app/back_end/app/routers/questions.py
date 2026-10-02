from collections.abc import Sequence
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.deps import DbSession, get_or_404, save
from app.models import QUESTION_TYPE_DESCRIPTIONS, Job, Question, QuestionType
from app.schemas import QuestionCreate, QuestionRead, QuestionTypeInfo, QuestionUpdate

router = APIRouter(tags=["questions"])


def _require_allowed_type(job: Job, question_type: QuestionType) -> None:
    if question_type not in job.question_types:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"This job doesn't use '{question_type}' questions. Allowed: {', '.join(job.question_types)}.",
        )


@router.get("/question-types", response_model=list[QuestionTypeInfo])
def list_question_types() -> list[QuestionTypeInfo]:
    """The fixed set of question types, for populating pickers in the UI."""
    return [QuestionTypeInfo(value=t, description=QUESTION_TYPE_DESCRIPTIONS[t]) for t in QuestionType]


@router.post("/jobs/{job_id}/questions", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(job_id: int, body: QuestionCreate, db: DbSession) -> Question:
    job = get_or_404(db, Job, job_id)
    _require_allowed_type(job, body.type)
    return save(db, Question(job=job, **body.model_dump()))


@router.get("/jobs/{job_id}/questions", response_model=list[QuestionRead])
def list_questions(
    job_id: int,
    db: DbSession,
    type_: Annotated[QuestionType | None, Query(alias="type", description="Only return questions of this type")] = None,
) -> Sequence[Question]:
    get_or_404(db, Job, job_id)  # an unknown job is a 404, not an empty list
    query = select(Question).where(Question.job_id == job_id).order_by(Question.id)
    if type_ is not None:
        query = query.where(Question.type == type_)
    return db.scalars(query).all()


@router.get("/questions/{question_id}", response_model=QuestionRead)
def get_question(question_id: int, db: DbSession) -> Question:
    return get_or_404(db, Question, question_id)


@router.patch("/questions/{question_id}", response_model=QuestionRead)
def update_question(question_id: int, body: QuestionUpdate, db: DbSession) -> Question:
    question = get_or_404(db, Question, question_id)
    changes = body.model_dump(exclude_unset=True)

    new_type = changes.get("type")
    if new_type is not None and new_type != question.type:
        _require_allowed_type(question.job, new_type)
        if question.coding_challenge is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This question has a coding challenge. Delete the challenge before changing the question's type.",
            )

    for field, value in changes.items():
        setattr(question, field, value)
    return save(db, question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, db: DbSession) -> None:
    """Also deletes the question's coding challenge and removes it from any candidates."""
    db.delete(get_or_404(db, Question, question_id))
    db.commit()
