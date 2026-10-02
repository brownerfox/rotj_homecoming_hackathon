from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import DbSession, get_or_404, save
from app.models import CodingChallenge, Question, QuestionType
from app.schemas import CodingChallengeCreate, CodingChallengeRead, CodingChallengeUpdate

# A question has at most one challenge, so it is addressed through its question
# (/questions/7/coding-challenge) rather than by its own id.
router = APIRouter(prefix="/questions/{question_id}/coding-challenge", tags=["coding challenges"])


def _get_challenge_or_404(db: Session, question_id: int) -> CodingChallenge:
    challenge = get_or_404(db, Question, question_id).coding_challenge
    if challenge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Question {question_id} has no coding challenge")
    return challenge


@router.post("", response_model=CodingChallengeRead, status_code=status.HTTP_201_CREATED)
def create_coding_challenge(question_id: int, body: CodingChallengeCreate, db: DbSession) -> CodingChallenge:
    question = get_or_404(db, Question, question_id)
    if question.type != QuestionType.CODING:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Coding challenges can only be attached to '{QuestionType.CODING}' questions (this one is '{question.type}').",
        )
    if question.coding_challenge is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This question already has a coding challenge. Use PATCH to edit it.")
    return save(db, CodingChallenge(question=question, **body.model_dump()))


@router.get("", response_model=CodingChallengeRead)
def get_coding_challenge(question_id: int, db: DbSession) -> CodingChallenge:
    return _get_challenge_or_404(db, question_id)


@router.patch("", response_model=CodingChallengeRead)
def update_coding_challenge(question_id: int, body: CodingChallengeUpdate, db: DbSession) -> CodingChallenge:
    challenge = _get_challenge_or_404(db, question_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(challenge, field, value)
    return save(db, challenge)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_coding_challenge(question_id: int, db: DbSession) -> None:
    db.delete(_get_challenge_or_404(db, question_id))
    db.commit()
