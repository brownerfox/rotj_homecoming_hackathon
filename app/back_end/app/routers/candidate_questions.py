from collections.abc import Sequence

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.deps import DbSession, get_or_404, save
from app.models import Candidate, CandidateQuestion, Question
from app.schemas import CandidateQuestionCreate, CandidateQuestionRead, CandidateQuestionUpdate

router = APIRouter(prefix="/candidates/{candidate_id}/questions", tags=["candidate questions"])


def _get_link_or_404(db: Session, candidate_id: int, question_id: int) -> CandidateQuestion:
    link = db.get(CandidateQuestion, (candidate_id, question_id))
    if link is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"Question {question_id} is not assigned to candidate {candidate_id}"
        )
    return link


@router.post("", response_model=CandidateQuestionRead, status_code=status.HTTP_201_CREATED)
def assign_question(candidate_id: int, body: CandidateQuestionCreate, db: DbSession) -> CandidateQuestion:
    """Assign an existing question to a candidate. To ask a brand-new follow-up, create it with
    POST /jobs/{job_id}/questions first, then assign it here."""
    candidate = get_or_404(db, Candidate, candidate_id)
    question = get_or_404(db, Question, body.question_id)
    if question.job_id != candidate.job_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The question and the candidate belong to different jobs.")
    if db.get(CandidateQuestion, (candidate_id, question.id)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This question is already assigned to this candidate.")
    return save(db, CandidateQuestion(candidate=candidate, question=question, rationale=body.rationale))


@router.get("", response_model=list[CandidateQuestionRead])
def list_candidate_questions(candidate_id: int, db: DbSession) -> Sequence[CandidateQuestion]:
    get_or_404(db, Candidate, candidate_id)
    return db.scalars(
        select(CandidateQuestion)
        .where(CandidateQuestion.candidate_id == candidate_id)
        # Load every embedded question in one extra query instead of one query per row.
        .options(selectinload(CandidateQuestion.question))
        .order_by(CandidateQuestion.created_at, CandidateQuestion.question_id)
    ).all()


@router.patch("/{question_id}", response_model=CandidateQuestionRead)
def update_candidate_question(
    candidate_id: int, question_id: int, body: CandidateQuestionUpdate, db: DbSession
) -> CandidateQuestion:
    link = _get_link_or_404(db, candidate_id, question_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(link, field, value)
    return save(db, link)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def unassign_question(candidate_id: int, question_id: int, db: DbSession) -> None:
    """Removes the assignment only. The question stays in the job's question bank."""
    db.delete(_get_link_or_404(db, candidate_id, question_id))
    db.commit()
