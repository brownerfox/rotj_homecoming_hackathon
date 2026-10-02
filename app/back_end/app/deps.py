from typing import Annotated, TypeVar

from fastapi import Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import Base, get_db

# Declare `db: DbSession` on an endpoint to receive the request's database session.
DbSession = Annotated[Session, Depends(get_db)]

M = TypeVar("M", bound=Base)

MAX_PDF_BYTES = 10 * 1024 * 1024


def get_or_404(db: Session, model: type[M], object_id: int) -> M:
    obj = db.get(model, object_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} {object_id} not found")
    return obj


def save(db: Session, obj: M) -> M:
    """Insert or update `obj`, then reload it so database-set columns (ids, timestamps) are filled in."""
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def read_pdf_uploads(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    """Return (file name, bytes) for each upload. If any file isn't a PDF or is too large, the whole
    request is rejected, so nothing is created (or paid for) until every file passes."""
    uploads, problems = [], []
    for file in files:
        name = file.filename or "upload.pdf"
        data = file.file.read()
        if not name.lower().endswith(".pdf"):
            problems.append(f"{name} isn't a PDF")
        elif len(data) > MAX_PDF_BYTES:
            problems.append(f"{name} is over 10 MB")
        uploads.append((name, data))
    if problems:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "; ".join(problems) + ".")
    return uploads
