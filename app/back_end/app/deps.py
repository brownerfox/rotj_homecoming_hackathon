from typing import Annotated, TypeVar

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import Base, get_db

# Declare `db: DbSession` on an endpoint to receive the request's database session.
DbSession = Annotated[Session, Depends(get_db)]

M = TypeVar("M", bound=Base)


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
