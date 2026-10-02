"""Load demo data. Run from app/back_end:

    python -m app.seed          # only if the database is empty
    python -m app.seed --reset  # delete ALL data, then load the demo data
"""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import Candidate, CandidateQuestion, CodingChallenge, Job, ProgrammingLanguage, Question, QuestionType

# Challenge convention: the candidate's code is saved as solution.py, and the tests import from it.
SKELETON = '''\
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

REFERENCE = '''\
def merge_intervals(intervals: list[tuple[int, int]]) -> list[tuple[int, int]]:
    merged: list[tuple[int, int]] = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
'''


def seed(db: Session) -> None:
    job = Job(
        title="Backend Engineer (Python)",
        context=(
            "Mid-level engineer on a six-person platform team that owns the public REST API for a B2B "
            "scheduling product. Day to day: designing endpoints, writing SQL against Postgres, debugging "
            "production issues, and reviewing teammates' code. Success at six months means shipping features "
            "end to end on their own and taking part in the on-call rotation."
        ),
        skills=["Python", "REST API design", "SQL", "Testing", "Debugging", "Communication"],
        question_types=[QuestionType.BEHAVIORAL, QuestionType.TECHNICAL, QuestionType.SYSTEM_DESIGN, QuestionType.CODING],
    )

    incident = Question(
        type=QuestionType.BEHAVIORAL,
        text=(
            "Tell me about a production incident you helped resolve. What was your role, how did you find "
            "the cause, and what changed afterward?"
        ),
        skills=["Debugging", "Communication"],
        rubric=(
            "- **Strong:** clear timeline; owns their part; explains how the root cause was found (logs, "
            "metrics, bisecting); names a concrete follow-up that prevents a repeat.\n"
            "- **Acceptable:** fixed it, but the diagnosis was luck or someone else's; vague follow-up.\n"
            "- **Weak:** no specific example, or blames others without reflection."
        ),
    )
    indexes = Question(
        type=QuestionType.TECHNICAL,
        text="How does a database index speed up reads, and what does it cost? When would you not add one?",
        skills=["SQL"],
        rubric=(
            "- Explains lookup through an ordered structure (B-tree) instead of a full table scan.\n"
            "- Names the costs: slower writes, extra storage, more to maintain.\n"
            "- Knows when to skip one: low-selectivity columns, small or write-heavy tables."
        ),
    )
    rate_limiter = Question(
        type=QuestionType.SYSTEM_DESIGN,
        text=(
            "Design a rate limiter for our public API that allows each customer 100 requests per minute. "
            "Where does it run, and where does its state live?"
        ),
        skills=["REST API design"],
        rubric=(
            "- Picks and justifies an algorithm (token bucket, sliding window).\n"
            "- Keeps counters in a shared store (e.g. Redis) so every API instance agrees.\n"
            "- Returns 429 with Retry-After; decides what happens if the store is down."
        ),
        notes="Good one for a 30-minute slot. Steer away from rate limiting in the load balancer if time is short.",
    )
    merge = Question(
        type=QuestionType.CODING,
        text="Write merge_intervals(intervals), which merges overlapping meeting times. Talk through edge cases as you go.",
        skills=["Python", "Testing"],
        rubric=(
            "- Sorts and then makes one pass: O(n log n).\n"
            "- Handles touching intervals, contained intervals, and empty input.\n"
            "- Tests their own code or reasons through cases unprompted."
        ),
        coding_challenge=CodingChallenge(
            language=ProgrammingLanguage.PYTHON,
            skeleton_code=SKELETON,
            test_code=TESTS,
            reference_solution=REFERENCE,
        ),
    )
    migration_follow_up = Question(
        type=QuestionType.TECHNICAL,
        text=(
            "Your resume mentions a zero-downtime migration of 40M rows from MySQL to Postgres. Walk me through "
            "the cutover: how did you keep the two databases in sync, and how did you know it was safe to switch?"
        ),
        skills=["SQL", "Communication"],
        rubric=(
            "- Describes dual writes or change data capture, a backfill, and verification (counts, checksums).\n"
            "- Has a rollback plan.\n"
            "- Separates their own contribution from the team's."
        ),
    )
    job.questions = [incident, indexes, rate_limiter, merge, migration_follow_up]

    candidate = Candidate(
        name="Alex Rivera",
        resume_text=(
            "Software Engineer, Acme Payments, 2022 to present\n"
            "- Led the zero-downtime migration of the payments service from MySQL to Postgres (40M rows).\n"
            "- Built a Kafka event pipeline processing 2k events per second.\n"
            "- On call for the payments API; wrote the team's incident runbook.\n\n"
            "Skills: Python, FastAPI, PostgreSQL, Kafka, Docker"
        ),
        question_links=[
            CandidateQuestion(
                question=migration_follow_up,
                rationale="Resume claims a zero-downtime MySQL to Postgres migration. Check depth and personal ownership.",
            ),
            CandidateQuestion(
                question=incident,
                rationale="Was on call for the payments API and wrote the runbook, so expect a strong, specific story.",
            ),
        ],
    )
    job.candidates = [candidate]

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
