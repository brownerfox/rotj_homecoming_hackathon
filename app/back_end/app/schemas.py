"""Request and response bodies.

Each resource has three shapes:
  *Create  POST body. Required fields have no default.
  *Update  PATCH body. Omitted fields are left unchanged. Columns that can't be null are declared
           `X = Field(default=None)` rather than `X | None`: leaving the field out is fine, but
           sending an explicit null is rejected with a 422 instead of reaching the database.
  *Read    Response. Built straight from the ORM object (from_attributes).
"""

from datetime import UTC, datetime
from typing import Annotated, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.models import ProgrammingLanguage, QuestionType

S = TypeVar("S", bound=str)

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _not_blank(value: str) -> str:
    # Unlike NonEmptyStr this keeps whitespace as-is: indentation and newlines matter in code.
    if not value.strip():
        raise ValueError("must not be blank")
    return value


Code = Annotated[str, AfterValidator(_not_blank)]


def _dedupe(items: list[S]) -> list[S]:
    """Drop repeats (case-insensitively, so "SQL" and "sql" count once), keeping first-seen order."""
    seen: set[str] = set()
    unique = []
    for item in items:
        if item.casefold() not in seen:
            seen.add(item.casefold())
            unique.append(item)
    return unique


SkillList = Annotated[list[NonEmptyStr], AfterValidator(_dedupe)]
QuestionTypeList = Annotated[list[QuestionType], Field(min_length=1), AfterValidator(_dedupe)]


def _as_utc(value: datetime) -> datetime:
    # Timestamps are written in UTC, but SQLite drops the timezone. Re-attaching it makes the JSON
    # end in "Z", so browsers don't misread the value as local time.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class Timestamps(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    created_at: UTCDateTime
    updated_at: UTCDateTime


class Stored(Timestamps):
    id: int


# ---------------------------------------------------------------------------- Question types


class QuestionTypeInfo(BaseModel):
    value: QuestionType
    description: str


# ---------------------------------------------------------------------------------------- Jobs


class JobCreate(BaseModel):
    title: NonEmptyStr
    context: NonEmptyStr
    skills: SkillList = []
    question_types: QuestionTypeList


class JobUpdate(BaseModel):
    title: NonEmptyStr = Field(default=None)
    context: NonEmptyStr = Field(default=None)
    skills: SkillList = Field(default=None)
    question_types: QuestionTypeList = Field(default=None)


class JobRead(JobCreate, Stored):
    pass


# ----------------------------------------------------------------------------------- Questions


class QuestionCreate(BaseModel):
    type: QuestionType
    text: NonEmptyStr
    skills: SkillList = []
    rubric: str | None = None
    notes: str | None = None


class QuestionUpdate(BaseModel):
    type: QuestionType = Field(default=None)
    text: NonEmptyStr = Field(default=None)
    skills: SkillList = Field(default=None)
    rubric: str | None = None
    notes: str | None = None


class QuestionRead(QuestionCreate, Stored):
    job_id: int


# ---------------------------------------------------------------------------- Coding challenges


class CodingChallengeCreate(BaseModel):
    language: ProgrammingLanguage
    skeleton_code: Code
    test_code: Code
    reference_solution: Code


class CodingChallengeUpdate(BaseModel):
    language: ProgrammingLanguage = Field(default=None)
    skeleton_code: Code = Field(default=None)
    test_code: Code = Field(default=None)
    reference_solution: Code = Field(default=None)


class CodingChallengeRead(CodingChallengeCreate, Stored):
    question_id: int


# ---------------------------------------------------------------------------------- Candidates


class CandidateCreate(BaseModel):
    name: NonEmptyStr
    resume_text: str | None = None


class CandidateUpdate(BaseModel):
    name: NonEmptyStr = Field(default=None)
    resume_text: str | None = None


class CandidateRead(CandidateCreate, Stored):
    job_id: int


# ------------------------------------------------------------------------- Candidate questions


class CandidateQuestionCreate(BaseModel):
    question_id: int
    rationale: str | None = None


class CandidateQuestionUpdate(BaseModel):
    rationale: str | None = None


class CandidateQuestionRead(Timestamps):
    candidate_id: int
    question_id: int
    rationale: str | None
    # The full question is embedded so one request renders a candidate's interview plan.
    question: QuestionRead
