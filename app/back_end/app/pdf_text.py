"""Turning uploaded PDFs into plain text."""

import io

from pypdf import PdfReader

from app import ai


class UnreadablePDF(Exception):
    pass


def read_text_layer(data: bytes) -> str:
    """The PDF's embedded text, or "" if it has none (a scanned image)."""
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception as exc:  # pypdf raises many different exception types for corrupt or encrypted files
        raise UnreadablePDF from exc


def pdf_to_text(data: bytes) -> str:
    """The embedded text if there is any, otherwise Claude's transcription of the scanned pages."""
    return read_text_layer(data) or ai.transcribe_pdf(data)
