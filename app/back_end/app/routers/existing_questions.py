from collections.abc import Sequence
from typing import Annotated

import anthropic
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app import ai, pdf_text
from app.deps import DbSession, get_or_404, read_pdf_uploads
from app.models import ExistingQuestionFile, Job
from app.schemas import ExistingQuestionFileRead

# Optional PDFs of questions the hiring team already asks, so generated questions don't repeat them.
router = APIRouter(prefix="/jobs/{job_id}/existing-questions", tags=["existing questions"])


@router.post("", response_model=list[ExistingQuestionFileRead], status_code=status.HTTP_201_CREATED)
def upload_existing_questions(
    job_id: int,
    files: Annotated[list[UploadFile], File(description="One or more PDFs")],
    db: DbSession,
) -> list[ExistingQuestionFile]:
    """Stores each PDF's text. A scanned PDF (no text layer) is transcribed by Claude, which takes a
    few seconds and uses a little of the API budget."""
    job = get_or_404(db, Job, job_id)
    rows = []
    for name, data in read_pdf_uploads(files):
        try:
            text = pdf_text.pdf_to_text(data)
        except pdf_text.UnreadablePDF:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{name} isn't a readable PDF.")
        except (ai.GenerationError, anthropic.APIError) as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Couldn't read {name}: {ai.describe_error(exc)}")
        if not text:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"No text could be read from {name}.")
        rows.append(ExistingQuestionFile(file_name=name, text=text))
    job.existing_question_files.extend(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


@router.get("", response_model=list[ExistingQuestionFileRead])
def list_existing_questions(job_id: int, db: DbSession) -> Sequence[ExistingQuestionFile]:
    return get_or_404(db, Job, job_id).existing_question_files


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_questions(job_id: int, file_id: int, db: DbSession) -> None:
    """Affects resumes uploaded from now on. Questions already generated stay as they are."""
    row = db.get(ExistingQuestionFile, file_id)
    if row is None or row.job_id != job_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Job {job_id} has no existing-questions file {file_id}")
    db.delete(row)
    db.commit()
