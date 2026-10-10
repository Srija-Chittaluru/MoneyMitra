from datetime import date
from typing import Literal

from pydantic import BaseModel

Tenure = Literal["1y", "2y", "3y", "5y"]


class TenureOut(BaseModel):
    id: Tenure
    label: str
    months: int


class RdRateOut(BaseModel):
    provider_id: str
    provider_name: str
    kind: Literal["bank", "post_office"]
    tenure: Tenure
    customer_category: Literal["general", "senior_citizen"]
    annual_rate: float
    min_monthly: int | None
    effective_date: date
    source: str
    source_url: str


class RdRatesOut(BaseModel):
    tenures: list[TenureOut]
    rates: list[RdRateOut]
    # From the user's profile: 60 or older gets senior-citizen rates by default.
    is_senior: bool
    # About 5% of monthly income, rounded to ₹500; null when income is unknown.
    suggested_monthly: int | None
    suggestion_basis: str | None
    checked_on: date
    disclaimer: str
