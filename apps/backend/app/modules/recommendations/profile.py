from datetime import date
from enum import StrEnum

from fastapi import HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.modules.recommendations.stages import calculate_age
from app.modules.users.models import User

MAX_AGE = 120
MAX_EXPECTED_INCOME = 10_000_000_000


class EmployeeCategory(StrEnum):
    GOVERNMENT = "government"
    PSU = "psu"
    PRIVATE = "private"
    OTHER = "other"


class ProfileIn(BaseModel):
    """Replaces the whole recommendation profile; send null to clear a field."""

    model_config = ConfigDict(extra="forbid")

    date_of_birth: date | None = None
    employee_category: EmployeeCategory | None = None
    expected_annual_income: int | None = Field(default=None, ge=0, le=MAX_EXPECTED_INCOME)


class ProfileOut(BaseModel):
    date_of_birth: date | None
    employee_category: EmployeeCategory | None
    expected_annual_income: int | None


def profile_of(user: User) -> ProfileOut:
    return ProfileOut(
        date_of_birth=user.date_of_birth,
        employee_category=EmployeeCategory(user.employee_category) if user.employee_category else None,
        expected_annual_income=user.expected_annual_income,
    )


def update_profile(db: Session, user: User, payload: ProfileIn, today: date | None = None) -> ProfileOut:
    today = today or date.today()
    dob = payload.date_of_birth
    if dob is not None and not 0 <= calculate_age(dob, today) <= MAX_AGE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid date of birth.")

    user.date_of_birth = dob
    user.employee_category = payload.employee_category.value if payload.employee_category else None
    user.expected_annual_income = payload.expected_annual_income
    db.commit()
    db.refresh(user)
    return profile_of(user)
