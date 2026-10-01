import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ItrFiling(Base):
    """One ITR draft per user per assessment year.

    `data` holds the draft as entered (`ItrDraftData`). It contains PAN,
    Aadhaar and bank account numbers in plain text — encrypt this column at
    rest before production use.
    """

    __tablename__ = "itr_filings"
    __table_args__ = (UniqueConstraint("user_id", "assessment_year", name="uq_itr_filings_user_year"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    assessment_year: Mapped[str] = mapped_column(String(7))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    data: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), default=dict)
    # {"applied": [document ids], "sources": {draft path: {"label", "value"}}}
    # — which fields were auto-filled from uploaded documents.
    autofill: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), default=dict)
    last_exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
