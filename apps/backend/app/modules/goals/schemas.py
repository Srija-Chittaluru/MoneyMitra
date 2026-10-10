"""Request and response shapes for the Goals API.

Amount ranges and the target-date horizon are checked by the planner, not here,
so the rules exist once. These schemas only insist on whole numbers: `StrictInt`
rejects true, "5" and 5.5 instead of coercing them.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from app.modules.goals.types import GoalStatus, GoalType


def _clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


class GoalIn(BaseModel):
    """Creates a goal, or replaces an active goal's details (status is changed separately)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(max_length=100)
    goal_type: GoalType
    # Both optional: the wizard can create a goal before its cost or date is
    # settled ("Not set yet" / "Not sure yet"). No plan exists until both are.
    target_date: date | None = None
    cost_today: StrictInt | None = None
    existing_savings: StrictInt = 0
    loan_pct: StrictInt = Field(default=0, ge=0, le=100)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        title = _clean_text(value)
        if title is None:
            raise ValueError("Give the goal a name.")
        return title


class ContributionIn(BaseModel):
    """Money the user actually put towards the goal."""

    model_config = ConfigDict(extra="forbid")

    amount: StrictInt
    contributed_on: date
    note: str | None = Field(default=None, max_length=200)

    @field_validator("note")
    @classmethod
    def _note(cls, value: str | None) -> str | None:
        return _clean_text(value)


class ContributionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    goal_id: uuid.UUID
    amount: int
    contributed_on: date
    note: str | None
    created_at: datetime


class ApproachOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    risk: str
    annual_rate: float
    suggestion: str


class PlanOut(BaseModel):
    months: int
    inflation_rate: float
    future_cost: int
    funding_counted: int  # current funding, at face value
    financed_by_loan: int  # portion of future_cost expected via a loan, not savings
    remaining: int
    approach: ApproachOut
    monthly_needed: int
    assumptions: list[str]
    disclosure: str


class TakeHomeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reliability: str
    monthly: int | None
    source: str | None
    financial_year: str | None
    professional_tax_estimated: bool


class ScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    count: int
    monthly: int
    first_due: date
    last_due: date
    description: str


class BreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    take_home: int
    expenses: int
    expenses_estimated: bool
    commitments: int
    available: int
    comfortable: int


class LaterDateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    target_date: date
    months: int
    monthly_needed: int
    future_cost: int
    approach: ApproachOut


class LowerCostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cost_today: int
    future_cost: int
    monthly_needed: int


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    annual_rate: float
    term_months: int
    monthly_savings: int
    down_payment: int
    loan_amount: int
    emi: int
    total_interest: int
    emi_fits: bool
    note: str


class AffordabilityOut(BaseModel):
    status: str  # "affordable" | "tight" | "unaffordable" | "unknown"
    reasons: list[str]
    take_home: TakeHomeOut
    schedule: ScheduleOut | None
    breakdown: BreakdownOut | None
    later_date: LaterDateOut | None
    lower_cost: LowerCostOut | None
    loan: LoanOut | None
    notes: list[str]


class GoalOut(BaseModel):
    id: uuid.UUID
    title: str
    goal_type: GoalType
    target_date: date | None
    cost_today: int | None
    existing_savings: int  # allocated at setup
    loan_pct: int
    priority: int
    status: GoalStatus
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    contributions_total: int
    current_funding: int  # existing_savings + contributions_total
    # Worked out on every request from the current inputs, never stored. Only for
    # active goals with both a cost and a date; `plan_issue` says why there's none.
    plan: PlanOut | None
    plan_issue: str | None
    affordability: AffordabilityOut | None


class ReorderIn(BaseModel):
    """New priority order for the caller's goals — every goal id must be included."""

    model_config = ConfigDict(extra="forbid")

    goal_ids: list[uuid.UUID]
