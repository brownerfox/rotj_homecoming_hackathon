from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QuestionType(StrEnum):
    """The fixed set of question types. Declaration order is display order: questions are
    always listed by type, in this order. Add a member here to add a type."""

    DEBUGGING = "debugging"
    BEHAVIORAL = "behavioral"
    SITUATIONAL = "situational"
    TECHNICAL = "technical"
    DEBUGGING = "debugging"
    SYSTEM_DESIGN = "system_design"
    RESUME_DEEP_DIVE = "resume_deep_dive"
    CODE_REVIEW = "code_review"
    DATA_MODELING = "data_modeling"
    TESTING_STRATEGY = "testing_strategy"
    MOTIVATION = "motivation"
    LEADERSHIP = "leadership"


# Shown in the UI and given to Claude, so it knows what each type means.
QUESTION_TYPE_DESCRIPTIONS: dict[QuestionType, str] = {
    QuestionType.DEBUGGING: "Finding and fixing a problem in existing code.",
    QuestionType.BEHAVIORAL: "Past experience: 'Tell me about a time you...'",
    QuestionType.SITUATIONAL: "A hypothetical scenario: 'What would you do if...'",
    QuestionType.TECHNICAL: "Conceptual knowledge, answered out loud.",
    QuestionType.DEBUGGING: "Talk through finding the cause of a bug or production problem. May include a short code snippet.",
    QuestionType.SYSTEM_DESIGN: "Open-ended architecture and trade-off discussion.",
    QuestionType.RESUME_DEEP_DIVE: "Probing specific projects and claims on the resume.",
    QuestionType.CODE_REVIEW: "What the candidate looks for and says when reviewing code.",
    QuestionType.DATA_MODELING: "Designing tables, schemas, and relationships.",
    QuestionType.TESTING_STRATEGY: "How the candidate would test a feature or system.",
    QuestionType.MOTIVATION: "Why this role, this company, and this kind of work.",
    QuestionType.LEADERSHIP: "Leading people or projects, and taking ownership.",
}

TYPE_ORDER = {question_type: position for position, question_type in enumerate(QuestionType)}


class ProgrammingLanguage(StrEnum):
    """Languages a coding challenge can be written in. Python only for the demo."""

    PYTHON = "python"


class CandidateStatus(StrEnum):
    PENDING = "pending"  # uploaded, waiting for a generation slot
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"  # see Candidate.error


def _enum_column(enum_cls: type[StrEnum]) -> Enum:
    # Stores the value ("system_design"), not the member name ("SYSTEM_DESIGN"), in a plain
    # VARCHAR rather than a database-native enum, so adding a member never needs a migration.
    return Enum(enum_cls, native_enum=False, length=32, values_callable=lambda e: [m.value for m in e])


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# Parent-side relationships use passive_deletes so ON DELETE CASCADE in the database does the
# cleanup: deleting a job removes everything under it whether the delete comes from the ORM or SQL.
_CHILDREN = {"cascade": "all, delete-orphan", "passive_deletes": True}


class Job(Timestamps, Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    # Skills the hiring team is looking for, as free text, e.g. ["Python", "SQL"].
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    # The hiring manager's notes on what the coding challenge should be like.
    coding_brief: Mapped[str | None] = mapped_column(Text)
    # Whether coding challenges come with starter code and tests (no starter code means no tests).
    starter_code: Mapped[bool] = mapped_column(Boolean, default=True)

    questions: Mapped[list["JobQuestion"]] = relationship(back_populates="job", **_CHILDREN)
    existing_question_files: Mapped[list["ExistingQuestionFile"]] = relationship(
        back_populates="job", order_by="ExistingQuestionFile.id", **_CHILDREN
    )
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job", **_CHILDREN)


class JobQuestion(Timestamps, Base):
    """How many questions of one type each candidate for this job gets."""

    __tablename__ = "job_questions"
    __table_args__ = (
        UniqueConstraint("job_id", "type"),  # one row per type; ask for more with a higher count
        CheckConstraint("count >= 1", name="count_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    type: Mapped[QuestionType] = mapped_column(_enum_column(QuestionType))
    count: Mapped[int]

    job: Mapped[Job] = relationship(back_populates="questions")


class ExistingQuestionFile(Timestamps, Base):
    """A PDF of questions the hiring team already asks, stored as text. Generation avoids repeating them."""

    __tablename__ = "existing_question_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="existing_question_files")


class Candidate(Timestamps, Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    # Read from the resume during generation; null until then, or if the resume has no name.
    name: Mapped[str | None] = mapped_column(String(200))
    resume_file_name: Mapped[str] = mapped_column(String(255))
    # Null only if the PDF couldn't be read.
    resume_text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[CandidateStatus] = mapped_column(_enum_column(CandidateStatus), default=CandidateStatus.PENDING)
    # Why generation failed, in words a recruiter can act on.
    error: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="candidates")
    # Generated copies, never linked back to JobQuestion: editing the job doesn't change them.
    questions: Mapped[list["CandidateQuestion"]] = relationship(back_populates="candidate", **_CHILDREN)
    coding_challenge: Mapped["CodingChallenge | None"] = relationship(back_populates="candidate", **_CHILDREN)


class CandidateQuestion(Timestamps, Base):
    __tablename__ = "candidate_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), index=True)
    type: Mapped[QuestionType] = mapped_column(_enum_column(QuestionType))
    prompt: Mapped[str] = mapped_column(Text)

    candidate: Mapped[Candidate] = relationship(back_populates="questions")


class CodingChallenge(Timestamps, Base):
    __tablename__ = "coding_challenges"
    __table_args__ = (
        CheckConstraint("(starter_code IS NULL) = (tests IS NULL)", name="starter_code_and_tests_together"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # unique=True makes this one-to-one: one challenge per candidate.
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), unique=True)
    language: Mapped[ProgrammingLanguage] = mapped_column(_enum_column(ProgrammingLanguage))
    # The problem statement the candidate reads.
    prompt: Mapped[str] = mapped_column(Text)
    # Both null when the job had starter code turned off. The candidate's file is solution.py,
    # and the tests import from it.
    starter_code: Mapped[str | None] = mapped_column(Text)
    tests: Mapped[str | None] = mapped_column(Text)
    # Reference solution for interviewers.
    solution_code: Mapped[str] = mapped_column(Text)

    candidate: Mapped[Candidate] = relationship(back_populates="coding_challenge")
