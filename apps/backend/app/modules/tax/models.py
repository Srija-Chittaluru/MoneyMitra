import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TaxComparisonSnapshot(Base):
    """The inputs of a user's most recent tax comparison (one row per user).

    The comparison itself is stateless; this exists so other modules, such as
    life-stage recommendations, can reuse the income and deductions the user
    already entered.
    """

    __tablename__ = "tax_comparison_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    tax_year: Mapped[str] = mapped_column(String(7))
    gross_total_income: Mapped[int] = mapped_column(BigInteger)
    section_80c: Mapped[int] = mapped_column(BigInteger, default=0)
    section_80d: Mapped[int] = mapped_column(BigInteger, default=0)
    hra_exemption: Mapped[int] = mapped_column(BigInteger, default=0)
    home_loan_interest: Mapped[int] = mapped_column(BigInteger, default=0)
    nps_contribution: Mapped[int] = mapped_column(BigInteger, default=0)
    other_deductions: Mapped[int] = mapped_column(BigInteger, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
