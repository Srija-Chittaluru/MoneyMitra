import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user, rate_limited_user
from app.modules.documents import service
from app.modules.documents.schemas import DocumentCategory, DocumentOut
from app.modules.users.models import User

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentOut]:
    return [DocumentOut.model_validate(d) for d in service.list_documents(db, current_user)]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    category: DocumentCategory = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(rate_limited_user("upload")),
    db: Session = Depends(get_db),
) -> DocumentOut:
    document = await service.upload_document(db, current_user, category, file)
    return DocumentOut.model_validate(document)


@router.get("/{document_id}/file")
def download_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    document = service.get_document(db, current_user, document_id)
    return FileResponse(
        service.file_path(document),
        media_type=document.content_type,
        filename=document.file_name,
        # PDFs and images open in the browser; anything else downloads.
        content_disposition_type="inline" if document.content_type != "application/json" else "attachment",
        # Stored files can never run scripts or load anything, even if opened directly.
        headers={"Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"},
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    service.delete_document(db, service.get_document(db, current_user, document_id))
