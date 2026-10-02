"""Load hand-written demo data (no Claude calls). Run from app/back_end:

    python -m app.seed          # only if the database is empty
    python -m app.seed --reset  # delete ALL data, then load the demo data
"""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import (
    Candidate,
    CandidateQuestion,
    CandidateStatus,
    CodingChallenge,
    ExistingQuestionFile,
    Job,
    JobQuestion,
    ProgrammingLanguage,
    QuestionType,
)

STARTER_CODE = '''\
def merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Merge overlapping (start, end) meeting times and return them sorted by start."""
    raise NotImplementedError
'''

TESTS = '''\
from solution import merge_intervals


def test_merges_overlapping_intervals():
    assert merge_intervals([(1, 3), (2, 6), (8, 10)]) == [(1, 6), (8, 10)]


def test_touching_intervals_merge():
    assert merge_intervals([(1, 4), (4, 5)]) == [(1, 5)]


def test_contained_interval_is_absorbed():
    assert merge_intervals([(1, 10), (2, 3)]) == [(1, 10)]


def test_unsorted_input():
    assert merge_intervals([(5, 7), (1, 2)]) == [(1, 2), (5, 7)]


def test_empty_input():
    assert merge_intervals([]) == []
'''

SOLUTION = '''\
def merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    merged: list[tuple[int, int]] = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
'''

RESUME = """\
Alex Rivera
Software Engineer, Acme Payments, 2022 to present
- Led the zero-downtime migration of the payments service from MySQL to Postgres (40M rows).
- Built a Kafka event pipeline processing 2k events per second.
- On call for the payments API; wrote the team's incident runbook.

Skills: Python, FastAPI, PostgreSQL, Kafka, Docker"""


def seed(db: Session) -> None:
    job = Job(
        title="Backend Engineer (Python)",
        description=(
            "Mid-level engineer on a six-person platform team that owns the public REST API for a B2B "
            "scheduling product. Day to day: designing endpoints, writing SQL against Postgres, debugging "
            "production issues, and reviewing teammates' code."
        ),
        skills=["Python", "REST API design", "SQL", "Debugging", "Communication"],
        coding_brief=(
            "We ingest millions of calendar events a day from customer systems, and the data is messy. "
            "Something about cleaning or merging time ranges would be close to the real work."
        ),
        starter_code=True,
        questions=[
            JobQuestion(type=QuestionType.BEHAVIORAL, count=2),
            JobQuestion(type=QuestionType.TECHNICAL, count=1),
            JobQuestion(type=QuestionType.DEBUGGING, count=1),
            JobQuestion(type=QuestionType.SYSTEM_DESIGN, count=1),
        ],
        existing_question_files=[
            ExistingQuestionFile(
                file_name="standard_questions.pdf",
                text=(
                    "1. Tell me about yourself.\n"
                    "2. Why do you want to work here?\n"
                    "3. Describe a time you disagreed with a teammate."
                ),
            )
        ],
    )

    alex = Candidate(
        name="Alex Rivera",
        resume_file_name="alex_rivera_resume.pdf",
        resume_text=RESUME,
        status=CandidateStatus.READY,
        questions=[
            CandidateQuestion(
                type=QuestionType.BEHAVIORAL,
                prompt=(
                    "You led a zero-downtime migration of 40 million payment rows. Tell me about a moment "
                    "in that project when the plan stopped working and how you decided what to do next."
                ),
            ),
            CandidateQuestion(
                type=QuestionType.BEHAVIORAL,
                prompt=(
                    "You wrote your team's incident runbook. Tell me about an incident where following "
                    "it wasn't enough, and what you changed in the runbook afterward."
                ),
            ),
            CandidateQuestion(
                type=QuestionType.TECHNICAL,
                prompt=(
                    "During your MySQL to Postgres cutover, how did you keep the two databases in sync, "
                    "and how did you know it was safe to switch?"
                ),
            ),
            CandidateQuestion(
                type=QuestionType.DEBUGGING,
                prompt=(
                    "Your Kafka pipeline's consumer lag starts climbing every day at 9am and recovers by "
                    "noon. Walk me through how you'd find out why."
                ),
            ),
            CandidateQuestion(
                type=QuestionType.SYSTEM_DESIGN,
                prompt=(
                    "Design how our API would accept calendar events from thousands of customers, given "
                    "your experience with event pipelines. Where would you put Kafka, if anywhere?"
                ),
            ),
        ],
        coding_challenge=CodingChallenge(
            language=ProgrammingLanguage.PYTHON,
            prompt=(
                "Customers send us meeting times that often overlap. Implement merge_intervals(intervals), "
                "which takes a list of (start, end) tuples and returns the merged, non-overlapping "
                "intervals sorted by start. Example: [(1, 3), (2, 6), (8, 10)] -> [(1, 6), (8, 10)]. "
                "Document your plan before you start and note anything you change along the way."
            ),
            starter_code=STARTER_CODE,
            tests=TESTS,
            solution_code=SOLUTION,
        ),
    )
    # A failed candidate, so the frontend has every status to show.
    failed = Candidate(
        name=None,
        resume_file_name="j_smith_cv.pdf",
        resume_text="J. Smith\nData Engineer, 2019 to present\n- Built Airflow pipelines feeding a Snowflake warehouse.",
        status=CandidateStatus.FAILED,
        error="Claude's rate limit was hit. Retry in a minute.",
    )
    job.candidates = [alex, failed]

    db.add(job)
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Load demo data into the database.")
    parser.add_argument("--reset", action="store_true", help="delete ALL existing data first")
    args = parser.parse_args()

    if args.reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with SessionLocal() as db:
        if db.scalar(select(Job.id).limit(1)) is not None:
            print("The database already has data. Run `python -m app.seed --reset` to replace it.")
            return
        seed(db)
    print(f"Seeded demo data into {engine.url}")


if __name__ == "__main__":
    main()
