from datetime import date
from typing import Literal

from pydantic import BaseModel


class InstrumentOptionOut(BaseModel):
    name: str
    description: str
    lock_in: str
    type: str
    why: str
    link: str | None


class PlanningSectionOut(BaseModel):
    section: str
    label: str
    cap: int
    declared_amount: int
    headroom: int
    monthly_target: int
    instruments: list[InstrumentOptionOut]


class RegimePosition(BaseModel):
    recommended_regime: str  # "old" | "new" | "either"
    difference: int


class TaxPlanOut(BaseModel):
    has_data: bool
    fy_label: str
    fy_end: date
    months_remaining: int
    # All None when the user has no date of birth on file.
    age: int | None
    stage_label: str | None
    context_source: Literal["itr_filing", "tax_comparison"] | None
    # None when has_data is False — nothing to compare yet.
    regime_position: RegimePosition | None
    regime_caveat: str
    sections: list[PlanningSectionOut]
