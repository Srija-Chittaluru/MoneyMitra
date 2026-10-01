import json
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.documents.models import Document
from app.modules.documents.schemas import DocumentCategory
from app.modules.extraction.autofill import clear_autofilled
from app.modules.extraction.parsers import EXTRACTABLE_CATEGORIES, UnreadableDocument, extract
from app.modules.itr import service as itr_service
from app.modules.itr.models import ItrFiling
from app.modules.itr.rules import ItrYearRules
from app.modules.itr.schemas import ItrDraftData
from app.modules.users.models import User

# Content type and extension are decided by the file's leading bytes, never
# by the client-supplied filename or Content-Type header.
_SIGNATURES = [
    (b"%PDF-", "application/pdf", ".pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
]
_CHUNK = 1024 * 1024
logger = logging.getLogger("moneymitra")


def storage_root() -> Path:
    return Path(get_settings().document_storage_dir)


def _detect_type(head: bytes, data: bytes) -> tuple[str, str] | None:
    for signature, content_type, extension in _SIGNATURES:
        if head.startswith(signature):
            return content_type, extension
    # AIS can be downloaded from the e-filing portal as JSON.
    if head.lstrip()[:1] in (b"{", b"["):
        try:
            json.loads(data)
        except ValueError:
            return None
        return "application/json", ".json"
    return None


def _display_name(name: str | None, extension: str) -> str:
    base = Path(name or "").name.strip() or f"document{extension}"
    return base[-255:]


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    data = bytearray()
    while chunk := await file.read(_CHUNK):
        data.extend(chunk)
        if len(data) > limit:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"File is larger than {limit // (1024 * 1024)} MB.",
            )
    return bytes(data)


def list_documents(db: Session, user: User) -> list[Document]:
    return list(
        db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.uploaded_at.desc()))
    )


async def upload_document(db: Session, user: User, category: DocumentCategory, file: UploadFile) -> Document:
    data = await _read_limited(file, get_settings().max_document_bytes)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")

    detected = _detect_type(data[:16], data)
    if detected is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF, JPG, PNG or JSON (AIS) files can be uploaded."
        )
    content_type, extension = detected

    document_id = uuid.uuid4()
    storage_key = f"{user.id}/{document_id}{extension}"
    path = storage_root() / storage_key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

    document = Document(
        id=document_id,
        user_id=user.id,
        category=category.value,
        file_name=_display_name(file.filename, extension),
        content_type=content_type,
        size_bytes=len(data),
        storage_key=storage_key,
    )
    db.add(document)
    try:
        db.commit()
    except Exception:
        path.unlink(missing_ok=True)
        raise
    db.refresh(document)

    _extract_and_autofill(db, user, document, data)
    db.refresh(document)
    return document


def _pdf_passwords(db: Session, user: User) -> list[str]:
    """AIS PDFs are locked with lowercase PAN + date of birth (DDMMYYYY)."""
    candidates = []
    for filing in db.scalars(select(ItrFiling).where(ItrFiling.user_id == user.id)):
        personal = (filing.data or {}).get("personal", {})
        pan, dob = personal.get("pan"), personal.get("date_of_birth") or (
            user.date_of_birth.isoformat() if user.date_of_birth else None
        )
        if pan and dob:
            y, m, d = dob.split("-")
            candidates.append(f"{pan.lower()}{d}{m}{y}")
    return candidates


def _extract_and_autofill(db: Session, user: User, document: Document, data: bytes) -> None:
    if _extract(db, user, document, data):
        document.extraction_message = itr_service.autofill_from_document(db, user, document)[:500]
        db.commit()


def _extract(db: Session, user: User, document: Document, data: bytes) -> bool:
    """Runs the parser and stores the result on the document. True when
    there is data to auto-fill."""
    document.extracted = None
    document.extraction_message = None
    if document.category not in EXTRACTABLE_CATEGORIES:
        document.extraction_status = "not_applicable"
        db.commit()
        return False
    try:
        extraction = extract(document.category, document.content_type, data, _pdf_passwords(db, user))
    except UnreadableDocument as exc:
        document.extraction_status = "unsupported"
        document.extraction_message = str(exc)
        db.commit()
        return False
    except Exception:
        # A parser bug must never lose the upload itself.
        logger.exception("Extraction failed for document %s", document.id)
        document.extraction_status = "unsupported"
        document.extraction_message = "This document could not be read automatically."
        db.commit()
        return False

    if extraction.is_empty:
        document.extraction_status = "nothing_found"
        document.extraction_message = "No ITR details could be found in this document."
        db.commit()
        return False

    document.extraction_status = "extracted"
    document.extracted = extraction.to_json()
    db.commit()
    return True


def reread_documents(db: Session, user: User, rules: ItrYearRules) -> ItrFiling:
    """Re-reads every uploaded document and fills the ITR draft again.
    Values the user typed or edited are kept; values that still match what
    was auto-filled are cleared first, so improved parsing can replace them."""
    filing = itr_service.get_or_create_filing(db, user, rules)
    autofill = filing.autofill or {}
    draft = clear_autofilled(ItrDraftData.model_validate(filing.data), autofill.get("sources", {}))
    filing.data = draft.model_dump(mode="json")
    filing.autofill = {"applied": [], "sources": {}}
    db.commit()

    for document in reversed(list_documents(db, user)):  # oldest first
        path = storage_root() / document.storage_key
        if path.is_file() and _extract(db, user, document, path.read_bytes()):
            document.extraction_message = itr_service.autofill_from_document(db, user, document)[:500]
            db.commit()
    db.refresh(filing)
    return filing


def get_document(db: Session, user: User, document_id: uuid.UUID) -> Document:
    document = db.get(Document, document_id)
    # Another user's document is reported as missing, not forbidden.
    if document is None or document.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return document


def file_path(document: Document) -> Path:
    path = storage_root() / document.storage_key
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document file is missing")
    return path


def delete_document(db: Session, document: Document) -> None:
    path = storage_root() / document.storage_key
    db.delete(document)
    db.commit()
    path.unlink(missing_ok=True)
