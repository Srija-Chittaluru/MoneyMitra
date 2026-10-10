import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.modules.users.pii import decrypt_pan, mask_pan

TAX_ONBOARDING_COMPLETED = "completed"
TAX_ONBOARDING_SKIPPED = "skipped"

# Rs 10 crore a month: far above any salary or spending, so it only stops typos.
MAX_MONTHLY_AMOUNT = 100_000_000


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            f"monthly_take_home BETWEEN 1 AND {MAX_MONTHLY_AMOUNT}", name="ck_users_monthly_take_home"
        ),
        CheckConstraint(
            f"monthly_expenses BETWEEN 0 AND {MAX_MONTHLY_AMOUNT}", name="ck_users_monthly_expenses"
        ),
    )

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

    # Financial profile for goal affordability, in whole rupees; NULL when not given.
    # Only ever what the user entered: a take-home here is user-confirmed, never an
    # estimate. Expenses exclude MoneyMitra goal contributions, which are counted separately.
    monthly_take_home: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    monthly_expenses: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # PAN is stored Fernet-encrypted (see users/pii.py) and never returned by the API;
    # only `pan_masked` is exposed.
    pan_encrypted: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Post-signup tax onboarding: NULL (not yet shown), "completed" or "skipped".
    tax_onboarding_status: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Sign-in lockout after repeated wrong passwords (see auth.service.login).
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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
