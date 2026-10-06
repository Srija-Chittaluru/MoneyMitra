from datetime import date

from pydantic import BaseModel


class GovernmentAlertOut(BaseModel):
    title: str
    date: date
    description: str
    category: str
    source: str | None


class DeductionLimitOut(BaseModel):
    section: str
    label: str
    limit_general: int
    limit_senior: int | None


class ResourcesOut(BaseModel):
    alerts: list[GovernmentAlertOut]
    deduction_limits: list[DeductionLimitOut]
