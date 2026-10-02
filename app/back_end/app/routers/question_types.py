from fastapi import APIRouter

from app.models import QUESTION_TYPE_DESCRIPTIONS, QuestionType
from app.schemas import QuestionTypeInfo

router = APIRouter(tags=["question types"])


@router.get("/question-types", response_model=list[QuestionTypeInfo])
def list_question_types() -> list[QuestionTypeInfo]:
    """The fixed set of question types, in display order, for populating pickers in the UI."""
    return [QuestionTypeInfo(value=t, description=QUESTION_TYPE_DESCRIPTIONS[t]) for t in QuestionType]
