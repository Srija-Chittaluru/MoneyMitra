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
    # What the same section held in the year the saved figures are for, when that
    # isn't the current year: a reference point, not progress for this year.
    last_year_amount: int | None
    # True when `declared_amount` is last year's figure assumed to continue
    # (home loan interest repeats every year; investments don't).
    carried_forward: bool
    note: str | None
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
    # The financial year the user's saved figures are for, and whether it is this one.
    data_fy_label: str | None
    data_is_current_year: bool
    # None when has_data is False — nothing to compare yet.
    regime_position: RegimePosition | None
    regime_caveat: str
    sections: list[PlanningSectionOut]
