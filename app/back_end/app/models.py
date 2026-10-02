from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QuestionType(StrEnum):
    """The fixed set of question formats. Add a member here to add a type; nothing else changes."""

    BEHAVIORAL = "behavioral"
    SITUATIONAL = "situational"
    TECHNICAL = "technical"
    SYSTEM_DESIGN = "system_design"
    CODING = "coding"


QUESTION_TYPE_DESCRIPTIONS: dict[QuestionType, str] = {
    QuestionType.BEHAVIORAL: "Past experience: 'Tell me about a time you...'",
    QuestionType.SITUATIONAL: "Hypothetical scenario: 'What would you do if...'",
    QuestionType.TECHNICAL: "Conceptual knowledge, answered verbally.",
    QuestionType.SYSTEM_DESIGN: "Open-ended architecture and trade-off discussion.",
    QuestionType.CODING: "Hands-on problem. The only type that can have a coding challenge.",
}


class ProgrammingLanguage(StrEnum):
    """Languages a coding challenge can be written in (matches the frontend's language picker)."""

    PYTHON = "python"
    JAVA = "java"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    CPP = "cpp"
    C = "c"


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
# cleanup: deleting a job removes its questions, candidates, coding challenges, and
# candidate-question links whether the delete comes from the ORM or from raw SQL.
_CHILDREN = {"cascade": "all, delete-orphan", "passive_deletes": True}


class Job(Timestamps, Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    # Free-form description of the role: team, responsibilities, seniority, what success looks like.
    context: Mapped[str] = mapped_column(Text)
    # Skills the hiring team wants to assess, e.g. ["Python", "SQL", "System design"].
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    # QuestionType values this job's questions may use, e.g. ["behavioral", "coding"].
    question_types: Mapped[list[str]] = mapped_column(JSON, default=list)

    questions: Mapped[list["Question"]] = relationship(back_populates="job", **_CHILDREN)
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job", **_CHILDREN)


class Question(Timestamps, Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    type: Mapped[QuestionType] = mapped_column(_enum_column(QuestionType))
    text: Mapped[str] = mapped_column(Text)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)
    # Markdown guidance interviewers score answers against.
    rubric: Mapped[str | None] = mapped_column(Text)
    # Free-form interviewer notes.
    notes: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="questions")
    coding_challenge: Mapped["CodingChallenge | None"] = relationship(back_populates="question", **_CHILDREN)
    candidate_links: Mapped[list["CandidateQuestion"]] = relationship(back_populates="question", **_CHILDREN)


class CodingChallenge(Timestamps, Base):
    __tablename__ = "coding_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    # unique=True makes this one-to-one: a coding question has at most one challenge.
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), unique=True)
    language: Mapped[ProgrammingLanguage] = mapped_column(_enum_column(ProgrammingLanguage))
    # Starter code handed to the candidate; defines the function/class names the tests call.
    skeleton_code: Mapped[str] = mapped_column(Text)
    # Tests run against a candidate's solution. Never show these or the reference to candidates.
    test_code: Mapped[str] = mapped_column(Text)
    reference_solution: Mapped[str] = mapped_column(Text)

    question: Mapped[Question] = relationship(back_populates="coding_challenge")


class Candidate(Timestamps, Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    resume_text: Mapped[str | None] = mapped_column(Text)

    job: Mapped[Job] = relationship(back_populates="candidates")
    question_links: Mapped[list["CandidateQuestion"]] = relationship(back_populates="candidate", **_CHILDREN)


class CandidateQuestion(Timestamps, Base):
    """Junction table: a question chosen for (or written for) one candidate, e.g. a follow-up
    probing something on their resume. The (candidate_id, question_id) pair is the primary
    key, so the same question can't be assigned to the same candidate twice."""

    __tablename__ = "candidate_questions"

    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True, index=True)
    # Why this question targets this candidate, e.g. "Resume claims a zero-downtime Postgres migration".
    rationale: Mapped[str | None] = mapped_column(Text)

    candidate: Mapped[Candidate] = relationship(back_populates="question_links")
    question: Mapped[Question] = relationship(back_populates="candidate_links")
