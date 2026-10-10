"""The plan for one savings goal: what it will cost, and what to put aside each month.

Pure: no database, user profile or request. Every formula and rate comes from
`recommendations/wealth.py`; this module only puts them together for a goal.
Existing savings are counted at face value: we don't assume they've been moved
into, or will earn, any particular investment.
"""

from dataclasses import dataclass
from datetime import date

from app.modules.recommendations import wealth
from app.modules.recommendations.money import format_inr as inr

# Rs 100 crore: well above any personal goal, so it only stops typos. The ITR's
# MAX_AMOUNT (Rs 1,000 crore) bounds tax-return figures, not goals.
MAX_GOAL_AMOUNT = 1_000_000_000
MIN_GOAL_COST = 100

# Required monthly savings are rounded up to this, so they're never understated.
MONTHLY_ROUNDING = 100

GOAL_DISCLOSURE = (
    "These figures are illustrative, not a forecast or advice to buy any product. They use assumed rates for "
    "price rises and investment returns; real rates change. Returns are shown before tax: interest and gains "
    "may be taxed, so what you keep could be lower. Market-linked investments can lose value, and actual "
    "results will differ."
)


class GoalInputError(ValueError):
    """An input the plan can't be built from. `field` names the input at fault."""

    def __init__(self, field: str, message: str):
        super().__init__(message)
        self.field = field


@dataclass(frozen=True)
class GoalInputs:
    target_date: date
    cost_today: int  # whole rupees, in today's prices
    existing_savings: int = 0  # whole rupees already put aside for this goal
    loan_pct: int = 0  # 0-100; share of the future cost expected via a loan, not savings


@dataclass(frozen=True)
class GoalPlan:
    months: int
    target_date: date
    cost_today: int
    inflation_rate: float
    future_cost: int
    existing_savings: int  # at face value
    financed_by_loan: int
    remaining: int
    approach: wealth.InvestmentApproach
    monthly_needed: int  # rounded up to MONTHLY_ROUNDING; 0 when savings already cover the goal
    assumptions: list[str]
    disclosure: str


def _check_amount(field: str, value: int, allow_zero: bool) -> None:
    if not isinstance(value, int) or isinstance(value, bool):
        raise GoalInputError(field, "Enter a whole number of rupees.")
    if value < 0 and allow_zero:
        raise GoalInputError(field, "Amount can't be negative.")
    if value <= 0 and not allow_zero:
        raise GoalInputError(field, "Enter an amount above zero.")
    if value > MAX_GOAL_AMOUNT:
        raise GoalInputError(field, f"Amount can't be more than {inr(MAX_GOAL_AMOUNT)}.")


def _months_to(target_date: date, today: date) -> int:
    months = wealth.months_until(target_date, today)
    if months < wealth.MIN_GOAL_MONTHS:
        raise GoalInputError("target_date", "Choose a target date in a future month.")
    if months > wealth.MAX_GOAL_MONTHS:
        raise GoalInputError("target_date", f"Choose a target date within {wealth.MAX_GOAL_MONTHS // 12} years.")
    return months


def _assumptions(plan_months: int, inflation_rate: float, existing: int, financed: int,
                 approach: wealth.InvestmentApproach, monthly_needed: int) -> list[str]:
    assumptions = [
        f"Prices rise {inflation_rate:.0%} a year until your target date.",
        f"With {plan_months} month{'s' if plan_months != 1 else ''} to go, the money suits a "
        f"{approach.label.lower()} approach ({approach.risk} risk): {approach.suggestion.lower()}.",
    ]
    if existing:
        assumptions.append(f"The {inr(existing)} you've already saved is counted as it is, with no growth.")
    if financed:
        assumptions.append(f"{inr(financed)} of the cost is assumed to come from a loan, not your savings.")
    if monthly_needed:
        assumptions += [
            f"Monthly savings are assumed to earn {approach.annual_rate:.1%} a year before tax, compounded monthly.",
            "You invest at the end of each month, starting this month.",
            f"The monthly amount is rounded up to the nearest {inr(MONTHLY_ROUNDING)}.",
        ]
    return assumptions


def plan_goal(
    inputs: GoalInputs,
    today: date,
    *,
    inflation_rate: float = wealth.INFLATION,
    approaches: tuple[wealth.InvestmentApproach, ...] = wealth.INVESTMENT_APPROACHES,
) -> GoalPlan:
    """Raises GoalInputError for a date outside 1 to 480 months away or an invalid amount."""
    _check_amount("cost_today", inputs.cost_today, allow_zero=False)
    if inputs.cost_today < MIN_GOAL_COST:
        raise GoalInputError("cost_today", f"Enter a cost of at least {inr(MIN_GOAL_COST)}.")
    _check_amount("existing_savings", inputs.existing_savings, allow_zero=True)
    if not 0 <= inputs.loan_pct <= 100:
        raise GoalInputError("loan_pct", "Loan percentage must be between 0 and 100.")
    months = _months_to(inputs.target_date, today)

    future_cost = wealth.round_up_to(wealth.inflated_cost_months(inputs.cost_today, inflation_rate, months), 1)
    financed = round(future_cost * inputs.loan_pct / 100)
    remaining = max(0, future_cost - inputs.existing_savings - financed)
    approach = wealth.investment_approach(months, approaches)
    monthly_needed = (
        wealth.round_up_to(wealth.monthly_needed_months(remaining, approach.annual_rate, months), MONTHLY_ROUNDING)
        if remaining
        else 0
    )

    return GoalPlan(
        months=months,
        target_date=inputs.target_date,
        cost_today=inputs.cost_today,
        inflation_rate=inflation_rate,
        future_cost=future_cost,
        existing_savings=inputs.existing_savings,
        financed_by_loan=financed,
        remaining=remaining,
        approach=approach,
        monthly_needed=monthly_needed,
        assumptions=_assumptions(months, inflation_rate, inputs.existing_savings, financed, approach, monthly_needed),
        disclosure=GOAL_DISCLOSURE,
    )
