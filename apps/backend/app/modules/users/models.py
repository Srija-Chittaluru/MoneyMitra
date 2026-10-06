import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.users.pii import decrypt_pan, mask_pan

TAX_ONBOARDING_COMPLETED = "completed"
TAX_ONBOARDING_SKIPPED = "skipped"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    # One-time input; not used for any business logic yet. Reserved for
    # future Tax Comparison / Life-stage Recommendation modules.
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Recommendation profile (see app/modules/recommendations/profile.py).
    employee_category: Mapped[str | None] = mapped_column(String(16), nullable=True)
    expected_annual_income: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def pan_masked(self) -> str | None:
        if not self.pan_encrypted:
            return None
        pan = decrypt_pan(self.pan_encrypted)
        return mask_pan(pan) if pan else None
