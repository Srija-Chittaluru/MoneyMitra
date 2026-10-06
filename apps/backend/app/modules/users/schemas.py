import uuid
from datetime import date, datetime

from datetime import timezone

from pydantic import BaseModel, ConfigDict, field_validator

from app.modules.users.pii import is_valid_pan, normalize_pan


class UserPublic(BaseModel):
    """Safe, external-facing user representation. Never includes password_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    date_of_birth: date | None
    pan_masked: str | None
    tax_onboarding_status: str | None
    created_at: datetime


MAX_AGE_YEARS = 120


class TaxProfileRequest(BaseModel):
    pan: str
    date_of_birth: date

    @field_validator("pan")
    @classmethod
    def _validate_pan(cls, value: str) -> str:
        pan = normalize_pan(value)
        if not is_valid_pan(pan):
            raise ValueError("Enter a valid PAN, like ABCDE1234F")
        return pan

    @field_validator("date_of_birth")
    @classmethod
    def _validate_dob(cls, value: date) -> date:
        today = datetime.now(timezone.utc).date()
        if value > today:
            raise ValueError("Date of birth can't be in the future")
        if value.year < today.year - MAX_AGE_YEARS:
            raise ValueError("Enter a valid date of birth")
        return value
