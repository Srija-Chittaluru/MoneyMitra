import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict


class DocumentCategory(str, Enum):
    PAN = "pan"
    FORM16 = "form16"
    AIS = "ais"
    PAYSLIPS = "payslips"
    TAX_PROOFS = "tax_proofs"
    BILLS = "bills"
    OTHER = "other"


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: DocumentCategory
    file_name: str
    content_type: str
    size_bytes: int
    uploaded_at: datetime
    extraction_status: str
    extraction_message: str | None
