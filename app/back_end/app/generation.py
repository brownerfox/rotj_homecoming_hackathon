"""Background generation: turns uploaded resumes into each candidate's questions and coding challenge."""

import logging
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import update
from sqlalchemy.orm import Session

from app import ai
from app.config import settings
from app.database import SessionLocal
from app.models import Candidate, CandidateQuestion, CandidateStatus, CodingChallenge

log = logging.getLogger(__name__)


def generate_for_candidates(job: ai.JobSnapshot, work: list[tuple[int, bytes | None]]) -> None:
    """Runs after the upload request returns. `work` pairs each candidate id with the PDF bytes of a
    scanned resume that still needs transcribing (None when its text was already extracted).
    A few candidates are processed at once; each one succeeds or fails on its own."""
    with ThreadPoolExecutor(max_workers=settings.generation_concurrency) as pool:
        futures = [pool.submit(_generate_one, job, candidate_id, scanned_pdf) for candidate_id, scanned_pdf in work]
    for future in futures:
        # _generate_one records its own failures; this only catches crashes outside that (e.g. the database).
        if exc := future.exception():
            log.error("Generation crashed", exc_info=exc)


def _generate_one(job: ai.JobSnapshot, candidate_id: int, scanned_pdf: bytes | None) -> None:
    with SessionLocal() as db:
        candidate = db.get(Candidate, candidate_id)
        if candidate is None:  # deleted while waiting its turn
            return
        candidate.status = CandidateStatus.GENERATING
        db.commit()
        try:
            if candidate.resume_text is None:
                if scanned_pdf is None:
                    raise ai.GenerationError("This resume has no text. Delete the candidate and upload the PDF again.")
                candidate.resume_text = ai.transcribe_pdf(scanned_pdf)
                db.commit()  # saved now so a retry doesn't pay to transcribe it again

            interview = ai.generate_interview(job, candidate.resume_text)

            candidate.name = interview.candidate_name or candidate.name
            candidate.questions = [CandidateQuestion(type=qtype, prompt=prompt) for qtype, prompt in interview.questions]
            candidate.coding_challenge = CodingChallenge(**interview.coding_challenge)
            candidate.status = CandidateStatus.READY
            candidate.error = None
            db.commit()
        except Exception as exc:
            if isinstance(exc, ai.GenerationError):  # expected and already explained; no traceback needed
                log.warning("Generation failed for candidate %s: %s", candidate_id, exc)
            else:
                log.exception("Generation failed for candidate %s", candidate_id)
            db.rollback()
            _mark_failed(db, candidate_id, ai.describe_error(exc))


def _mark_failed(db: Session, candidate_id: int, message: str) -> None:
    candidate = db.get(Candidate, candidate_id)
    if candidate is not None:  # it may have been deleted mid-generation
        candidate.status = CandidateStatus.FAILED
        candidate.error = message
        db.commit()


def fail_interrupted(db: Session) -> None:
    """At startup, nothing can still be generating: any candidate left pending or generating was
    cut off by a restart (including `fastapi dev` reloading after a file save)."""
    db.execute(
        update(Candidate)
        .where(Candidate.status.in_([CandidateStatus.PENDING, CandidateStatus.GENERATING]))
        .values(status=CandidateStatus.FAILED, error="Generation was interrupted by a server restart. Retry it.")
    )
    db.commit()
