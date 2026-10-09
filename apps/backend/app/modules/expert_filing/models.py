import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExpertFilingRequest(Base):
    """A user's request for CA help finishing a return they prepared in MoneyMitra.

    Created once they pick a paid plan at the review step; fulfilled manually
    by ops (no CA login/portal, no payment capture — this is a request to be
    contacted, not a receipt)."""

    __tablename__ = "expert_filing_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    assessment_year: Mapped[str] = mapped_column(String(7))
    plan: Mapped[str] = mapped_column(String(16))
    # Price and call count at request time, from PLAN_DETAILS — a historical
    # snapshot, so a later price change doesn't rewrite past requests.
    price: Mapped[int] = mapped_column(Integer)
    calls_included: Mapped[int] = mapped_column(Integer)
    contact_phone: Mapped[str] = mapped_column(String(20))
    preferred_time: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # "pending" | "contacted" | "scheduled" | "completed" | "cancelled" — ops-managed
    status: Mapped[str] = mapped_column(String(16), default="pending")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
