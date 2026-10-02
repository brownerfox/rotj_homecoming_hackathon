"""Request and response bodies.

Resources have up to three shapes:
  *Create  POST body. Required fields have no default.
  *Update  PATCH body. Omitted fields are left unchanged. Columns that can't be null are declared
           `X = Field(default=None)` rather than `X | None`: leaving the field out is fine, but
           sending an explicit null is rejected with a 422 instead of reaching the database.
  *Read    Response. Built straight from the ORM object (from_attributes).
"""

from datetime import UTC, datetime
from typing import Annotated, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.models import TYPE_ORDER, CandidateStatus, ProgrammingLanguage, QuestionType

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


def _by_type(items: list) -> list:
    """Questions are always listed by type, in QuestionType's declaration order."""
    return sorted(items, key=lambda item: (TYPE_ORDER[item.type], getattr(item, "id", 0)))


def _as_utc(value: datetime) -> datetime:
    # Timestamps are written in UTC, but SQLite drops the timezone. Re-attaching it makes the JSON
    # end in "Z", so browsers don't misread the value as local time.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class Stored(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: UTCDateTime
    updated_at: UTCDateTime


# ---------------------------------------------------------------------------- Question types


class QuestionTypeInfo(BaseModel):
    value: QuestionType
    description: str


# ---------------------------------------------------------------------------------------- Jobs


class JobQuestionCount(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    type: QuestionType
    # Capped because every question is generated (and paid for) once per candidate.
    count: Annotated[int, Field(ge=1, le=10)]


def _one_entry_per_type(items: list[JobQuestionCount]) -> list[JobQuestionCount]:
    types = [item.type for item in items]
    if len(set(types)) != len(types):
        raise ValueError("list each question type once, and use count to ask for more than one")
    return _by_type(items)


QuestionCounts = Annotated[list[JobQuestionCount], AfterValidator(_one_entry_per_type)]


class JobCreate(BaseModel):
    title: NonEmptyStr
    description: NonEmptyStr
    skills: SkillList = []
    # Typed-in existing questions. PDFs of them are uploaded separately.
    existing_questions: str | None = None
    coding_brief: str | None = None
    starter_code: bool = True
    questions: QuestionCounts = []


class JobUpdate(BaseModel):
    title: NonEmptyStr = Field(default=None)
    description: NonEmptyStr = Field(default=None)
    skills: SkillList = Field(default=None)
    existing_questions: str | None = None
    coding_brief: str | None = None
    starter_code: bool = Field(default=None)
    # Replaces the whole list. Types left out are removed.
    questions: QuestionCounts = Field(default=None)


class JobRead(JobCreate, Stored):
    pass


class ExistingQuestionFileRead(Stored):
    job_id: int
    file_name: str
    text: str


# ---------------------------------------------------------------------------------- Candidates


class CandidateSummary(Stored):
    job_id: int
    name: str | None
    resume_file_name: str
    status: CandidateStatus
    error: str | None


class CandidateUpdate(BaseModel):
    name: NonEmptyStr = Field(default=None)


class CandidateQuestionRead(Stored):
    type: QuestionType
    prompt: str


class CandidateQuestionUpdate(BaseModel):
    prompt: NonEmptyStr


class CodingChallengeRead(Stored):
    language: ProgrammingLanguage
    prompt: str
    starter_code: str | None
    tests: str | None
    solution_code: str


class CodingChallengeUpdate(BaseModel):
    prompt: NonEmptyStr = Field(default=None)
    # Set both or clear both: no starter code means no tests.
    starter_code: Code | None = None
    tests: Code | None = None
    solution_code: Code = Field(default=None)


class CandidateDetail(CandidateSummary):
    resume_text: str | None
    questions: Annotated[list[CandidateQuestionRead], AfterValidator(_by_type)]
    coding_challenge: CodingChallengeRead | None
