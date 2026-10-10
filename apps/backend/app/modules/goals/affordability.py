"""Whether a goal's monthly amount fits, and what would make it fit if it doesn't.

Pure: takes a GoalPlan and an explicit Capacity; no database or profile lookups.

  available   = take-home - monthly expenses - other goals' monthly amounts
  comfortable = available - a headroom of HEADROOM_SHARE of take-home

A goal is affordable when its monthly amount fits within `comfortable`, tight
when it fits only within `available`, and unaffordable otherwise. Without a
reliable take-home figure, the user's expenses, or the other goals' amounts,
the status is unknown: we never claim a goal fits, or doesn't, on a guess.
"""

import calendar
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum

from app.modules.goals.planner import MAX_GOAL_AMOUNT, MIN_GOAL_COST, GoalInputs, GoalPlan, plan_goal
from app.modules.goals.take_home import Reliability, TakeHome
from app.modules.goals.types import GoalType
from app.modules.recommendations import wealth
from app.modules.recommendations.money import format_inr as inr

# Money left over after the goal, as a share of take-home, below which a goal is
# "tight": a cushion for irregular costs. A MoneyMitra rule of thumb for flagging
# plans with little slack, not a financial rule.
HEADROOM_SHARE = 0.10

# Illustrative loan terms. Loans are only illustrated for these goal types.
LOAN_TERM_MONTHS = {GoalType.CAR: 60, GoalType.HOUSE: 240}

# Bounds the search for a lower cost that fits; each step re-runs the planner.
_MAX_COST_STEPS = 50


class Status(StrEnum):
    AFFORDABLE = "affordable"
    TIGHT = "tight"
    UNAFFORDABLE = "unaffordable"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class Commitment:
    """Another active goal's monthly amount. `key` identifies the goal, so a goal is
    never counted twice, or against itself."""

    key: str
    monthly: int


@dataclass(frozen=True)
class Capacity:
    take_home: TakeHome
    # Everything the user regularly spends each month: rent, EMIs, bills, insurance,
    # investments not tracked as goals here. Excludes MoneyMitra goals, which are
    # `commitments`. None when the user hasn't said.
    monthly_expenses: int | None
    # None when the other goals' amounts couldn't be gathered; an empty list means none.
    commitments: Sequence[Commitment] | None


@dataclass(frozen=True)
class ContributionSchedule:
    count: int
    monthly: int
    first_due: date
    last_due: date
    description: str


@dataclass(frozen=True)
class Breakdown:
    take_home: int
    expenses: int
    expenses_estimated: bool  # an illustrative share of take-home, not the user's figure
    commitments: int
    available: int  # can be negative
    comfortable: int  # `available` less the headroom; can be negative


@dataclass(frozen=True)
class LaterDate:
    target_date: date
    months: int
    monthly_needed: int
    future_cost: int
    approach: wealth.InvestmentApproach


@dataclass(frozen=True)
class LowerCost:
    cost_today: int
    future_cost: int
    monthly_needed: int


@dataclass(frozen=True)
class LoanIllustration:
    annual_rate: float
    term_months: int
    monthly_savings: int  # saved each month until the target date, for the down payment
    down_payment: int  # existing savings plus what that saving could grow to
    loan_amount: int
    emi: int  # paid each month after the purchase, for `term_months`
    total_interest: int
    emi_fits: bool  # within the comfortable monthly amount
    note: str


@dataclass(frozen=True)
class Assessment:
    status: Status
    reasons: list[str]
    schedule: ContributionSchedule | None
    # The figures behind the status; with an unknown status, an indication only.
    breakdown: Breakdown | None
    later_date: LaterDate | None = None
    lower_cost: LowerCost | None = None
    loan: LoanIllustration | None = None
    notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def _add_months(day: date, months: int) -> tuple[int, int]:
    index = day.year * 12 + day.month - 1 + months
    return index // 12, index % 12 + 1


def _fmt(day: date) -> str:
    return f"{day.day} {day:%b %Y}"


def contribution_schedule(plan: GoalPlan, today: date) -> ContributionSchedule | None:
    """When the monthly amounts fall due: at the end of each month from this one
    until the month before the target date."""
    if plan.monthly_needed == 0:
        return None
    first = _month_end(today.year, today.month)
    last = _month_end(*_add_months(today, plan.months - 1))
    if plan.months == 1:
        description = f"One contribution of {inr(plan.monthly_needed)} by {_fmt(first)}."
    else:
        description = (
            f"{plan.months} monthly contributions of {inr(plan.monthly_needed)}, the first by {_fmt(first)} "
            f"and the last by {_fmt(last)}."
        )
    days = (first - today).days
    if days < 7:  # a goal made late in the month: say so, rather than surprise
        description += " The first is due today." if days == 0 else f" The first is due in {days} day{'s' if days != 1 else ''}."
    return ContributionSchedule(plan.months, plan.monthly_needed, first, last, description)


def _commitments_total(commitments: Sequence[Commitment], goal_key: str | None) -> int:
    by_goal: dict[str, int] = {}
    for item in commitments:
        if item.monthly < 0:
            raise ValueError("a commitment can't be negative")
        if item.key != goal_key:
            by_goal[item.key] = item.monthly
    return sum(by_goal.values())


def _unknown_reason(take_home: TakeHome) -> str:
    match take_home.reliability:
        case Reliability.STALE:
            return (f"Your income figures are from FY {take_home.financial_year} ({take_home.source_label}). "
                    "Confirm your current monthly take-home pay to check this goal.")
        case Reliability.EXPECTED_ONLY:
            return (f"Your take-home of about {inr(take_home.monthly or 0)} is estimated from the expected income in "
                    "your profile, which isn't verified. Confirm your monthly take-home pay to check this goal.")
        case Reliability.INCOMPLETE:
            return (f"We couldn't estimate your take-home pay from your {take_home.source_label}. Enter your "
                    "monthly take-home pay to check this goal.")
        case _:
            return "We don't know your income yet. Enter your monthly take-home pay to check this goal."


def _breakdown(take_home: int, expenses: int | None, commitments: int) -> Breakdown:
    estimated = expenses is None
    if estimated:
        expenses = wealth.round_to(take_home * wealth.EXPENSE_SHARE, 100)
    available = take_home - expenses - commitments
    headroom = wealth.round_up_to(take_home * HEADROOM_SHARE, 1)
    return Breakdown(take_home, expenses, estimated, commitments, available, available - headroom)


def _budget(breakdown: Breakdown) -> int:
    """The most the goal could take each month comfortably, in whole hundreds."""
    return max(0, breakdown.comfortable // 100 * 100)


def _replan(plan: GoalPlan, today: date, target: date, cost: int, approaches) -> GoalPlan:
    inputs = GoalInputs(target_date=target, cost_today=cost, existing_savings=plan.existing_savings)
    return plan_goal(inputs, today, inflation_rate=plan.inflation_rate, approaches=approaches)


# ---------------------------------------------------------------------------
# Alternatives
# ---------------------------------------------------------------------------


def later_date(plan: GoalPlan, today: date, budget: int, approaches=wealth.INVESTMENT_APPROACHES) -> LaterDate | None:
    """The soonest later target month whose monthly amount fits `budget`. None if no
    date within the 40-year limit does, or nothing can be put aside each month."""
    if budget <= 0:
        return None
    for months in range(plan.months + 1, wealth.MAX_GOAL_MONTHS + 1):
        target = date(*_add_months(today, months), 1)
        candidate = _replan(plan, today, target, plan.cost_today, approaches)
        if candidate.monthly_needed <= budget:
            return LaterDate(target, months, candidate.monthly_needed, candidate.future_cost, candidate.approach)
    return None


def lower_cost(plan: GoalPlan, today: date, budget: int, approaches=wealth.INVESTMENT_APPROACHES) -> LowerCost | None:
    """The highest cost in today's money, below the planned one, that fits `budget` by
    the same target date. With nothing to put aside, that's what savings already cover."""
    saved = wealth.fv_sip_months(budget, plan.approach.annual_rate, plan.months) if budget else 0
    reachable = plan.existing_savings + saved
    cost = int(reachable / wealth.inflated_cost_months(1, plan.inflation_rate, plan.months))
    cost = min(cost, plan.cost_today - 1, MAX_GOAL_AMOUNT)
    step = 1_000 if cost >= 1_000 else 100
    cost = cost // step * step
    for _ in range(_MAX_COST_STEPS):
        if cost < MIN_GOAL_COST:
            return None
        candidate = _replan(plan, today, plan.target_date, cost, approaches)
        if candidate.monthly_needed <= budget:
            return LowerCost(cost, candidate.future_cost, candidate.monthly_needed)
        cost -= step
    return None


def loan_illustration(plan: GoalPlan, goal_type: str | None, budget: int) -> LoanIllustration | None:
    """Buying on the target date with a loan for whatever saving `budget` a month
    doesn't cover. Only for car and house goals; an illustration, not advice."""
    term = LOAN_TERM_MONTHS.get(goal_type or "")
    if term is None:
        return None
    saved = wealth.fv_sip_months(budget, plan.approach.annual_rate, plan.months) if budget else 0
    down_payment = min(plan.future_cost, int(plan.existing_savings + saved))
    loan = plan.future_cost - down_payment
    if loan <= 0:
        return None
    exact_emi = wealth.emi(loan, wealth.LOAN_RATE, term)
    emi = wealth.round_up_to(exact_emi, 1)
    total_interest = round(exact_emi * term - loan)
    note = (
        f"An illustration, not a recommendation: a loan at an assumed {wealth.LOAN_RATE:.0%} a year over "
        f"{term // 12} years costs about {inr(total_interest)} in interest. Real rates and terms depend on the "
        "lender and your credit."
    )
    return LoanIllustration(
        annual_rate=wealth.LOAN_RATE,
        term_months=term,
        monthly_savings=budget,
        down_payment=down_payment,
        loan_amount=loan,
        emi=emi,
        total_interest=total_interest,
        emi_fits=emi <= budget,
        note=note,
    )


# ---------------------------------------------------------------------------
# Assessment
# ---------------------------------------------------------------------------


def assess(
    plan: GoalPlan,
    capacity: Capacity,
    today: date,
    *,
    goal_key: str | None = None,
    goal_type: str | None = None,
    approaches: tuple[wealth.InvestmentApproach, ...] = wealth.INVESTMENT_APPROACHES,
) -> Assessment:
    """`today` must be the date the plan was made for. `goal_key` keeps this goal
    out of `capacity.commitments`; `goal_type` decides whether a loan is illustrated."""
    if capacity.monthly_expenses is not None and capacity.monthly_expenses < 0:
        raise ValueError("expenses can't be negative")
    schedule = contribution_schedule(plan, today)
    if plan.monthly_needed == 0:
        return Assessment(Status.AFFORDABLE, ["What you've already saved covers this goal."], None, None)

    take_home = capacity.take_home
    reasons = []
    if not take_home.is_reliable:
        reasons.append(_unknown_reason(take_home))
    if capacity.monthly_expenses is None:
        reasons.append("Add your monthly expenses to check whether this goal fits.")
    if capacity.commitments is None:
        reasons.append("Your other goals' monthly amounts couldn't be included.")
    commitments = _commitments_total(capacity.commitments or [], goal_key)

    breakdown = None
    if take_home.monthly is not None:
        breakdown = _breakdown(take_home.monthly, capacity.monthly_expenses, commitments)
    notes = list(take_home.notes)
    if breakdown and breakdown.expenses_estimated:
        notes.append(
            f"Expenses of {inr(breakdown.expenses)} are an illustration ({wealth.EXPENSE_SHARE:.0%} of take-home), "
            "not your figure."
        )
    if reasons or breakdown is None:
        return Assessment(Status.UNKNOWN, reasons, schedule, breakdown, notes=notes)

    if plan.monthly_needed > breakdown.available:
        status = Status.UNAFFORDABLE
        reasons.append(f"{inr(plan.monthly_needed)} a month is more than the {inr(max(0, breakdown.available))} "
                       "you have left after expenses and other goals.")
    elif plan.monthly_needed > breakdown.comfortable:
        status = Status.TIGHT
        reasons.append(f"It fits, but leaves less than {HEADROOM_SHARE:.0%} of your take-home spare each month.")
    else:
        return Assessment(Status.AFFORDABLE, [f"{inr(plan.monthly_needed)} a month fits within what you have left."],
                          schedule, breakdown, notes=notes)

    budget = _budget(breakdown)
    return Assessment(
        status,
        reasons,
        schedule,
        breakdown,
        later_date=later_date(plan, today, budget, approaches),
        lower_cost=lower_cost(plan, today, budget, approaches),
        loan=loan_illustration(plan, goal_type, budget),
        notes=notes,
    )
