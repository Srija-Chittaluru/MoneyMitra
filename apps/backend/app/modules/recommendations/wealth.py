"""The arithmetic and assumptions behind the 'how your money can grow' examples.

Every rate below is an **illustrative assumption**, not a forecast or a quote:
real rates move, and market-linked returns can be negative in any year. They
are kept in this one place, and always shown to the user next to the numbers
they produce, so they can be reviewed and updated without touching any advice.

Rates are nominal, yearly and before tax. The month-based helpers compound
monthly at `annual_rate / 12`, and assume a monthly contribution is made at the
end of each month (an ordinary annuity): the last one is made just as the
target month begins and earns nothing, the first earns `months - 1` months.
"""

import math
from dataclasses import dataclass
from datetime import date

# Annual rates used in examples.
SAVINGS_ACCOUNT_RATE = 0.03  # a typical bank savings account
SAFE_RATE = 0.065  # fixed deposits, liquid/debt funds, small-savings schemes
BALANCED_RATE = 0.08  # a mix of deposits/debt and equity, e.g. hybrid funds: not guaranteed
GROWTH_RATE = 0.10  # long-term, equity-oriented investing: not guaranteed
INFLATION = 0.06  # how fast everyday costs tend to rise
LOAN_RATE = 0.09  # an illustrative car or home loan rate, not a quote

# Rules of thumb that turn an income into example amounts.
EXPENSE_SHARE = 0.60  # monthly spending as a share of income, until the user's real figure is known
SAVINGS_SHARE = 0.20  # share of income to invest each month
CORPUS_MULTIPLE = 25  # retirement pot as a multiple of one year's spending (the "4% rule")
RETIREMENT_AGE = 60

# Used when MoneyMitra knows nothing about the user's income.
SAMPLE_MONTHLY_INCOME = 50_000

RATE_NOTE = (
    f"Example only, assuming {SAVINGS_ACCOUNT_RATE:.0%} a year in a savings account, {SAFE_RATE:.1%} in a fixed "
    f"deposit or liquid fund, and {GROWTH_RATE:.0%} for long-term equity-oriented investing. Real returns vary, "
    "market investments can lose value, and nothing here is a promise or a forecast."
)


# Goal horizons: at least a month away, at most 40 years.
MIN_GOAL_MONTHS = 1
MAX_GOAL_MONTHS = 40 * 12


@dataclass(frozen=True)
class InvestmentApproach:
    """Where money for a goal could sit, given how far away the goal is."""

    key: str
    label: str
    max_months: int | None  # inclusive upper bound; None for the last, open-ended band
    annual_rate: float
    risk: str  # "low" | "medium" | "high"
    suggestion: str


# Ordered shortest first. Money needed soon can't ride out a market fall, so
# shorter goals use safer, lower-return assumptions.
INVESTMENT_APPROACHES: tuple[InvestmentApproach, ...] = (
    InvestmentApproach(
        key="short_term", label="Under 3 years", max_months=35, annual_rate=SAFE_RATE, risk="low",
        suggestion="Recurring or fixed deposits, liquid or short-term debt funds",
    ),
    InvestmentApproach(
        key="medium_term", label="3 to 5 years", max_months=60, annual_rate=BALANCED_RATE, risk="medium",
        suggestion="A mix of deposits or debt funds and some equity, such as a hybrid fund",
    ),
    InvestmentApproach(
        key="long_term", label="More than 5 years", max_months=None, annual_rate=GROWTH_RATE, risk="high",
        suggestion="Equity mutual fund SIPs, moving to safer options as the date gets close",
    ),
)


def round_to(amount: float, step: int) -> int:
    return int(round(amount / step) * step)


def round_up_to(amount: float, step: int) -> int:
    """Rounds up to the next multiple of `step`, so a requirement is never understated.
    Rounds to the paisa first, so float noise like 5000.0000001 isn't pushed up a whole step."""
    return int(math.ceil(round(amount, 2) / step) * step)


def _check(months: int, *values: float) -> None:
    if months < 0:
        raise ValueError("months can't be negative")
    if any(value < 0 for value in values):
        raise ValueError("amounts and rates can't be negative")


def _sip_factor(monthly_rate: float, months: int) -> float:
    """What 1 a month, paid at each month's end, grows to after `months`."""
    if monthly_rate == 0:
        return months
    return ((1 + monthly_rate) ** months - 1) / monthly_rate


def months_until(target: date, today: date) -> int:
    """Calendar months from this month to the target month, ignoring the day:
    October 2026 to April 2027 is 6. Zero or less means the target isn't in a
    future month."""
    return (target.year - today.year) * 12 + (target.month - today.month)


def is_valid_goal_horizon(months: int) -> bool:
    return MIN_GOAL_MONTHS <= months <= MAX_GOAL_MONTHS


def investment_approach(
    months: int, approaches: tuple[InvestmentApproach, ...] = INVESTMENT_APPROACHES
) -> InvestmentApproach:
    """The approach for a goal `months` away. Pass `approaches` to use other assumptions."""
    if months < MIN_GOAL_MONTHS:
        raise ValueError("a goal must be at least a month away")
    for approach in approaches:
        if approach.max_months is None or months <= approach.max_months:
            return approach
    raise ValueError("no investment approach covers this horizon")


def inflated_cost_months(cost_today: float, annual_inflation: float, months: int) -> float:
    """What something costing `cost_today` will cost in `months`: prices compound
    yearly, applied over fractional years (`months / 12`)."""
    _check(months, cost_today, annual_inflation)
    return cost_today * (1 + annual_inflation) ** (months / 12)


def fv_lump_sum_months(amount: float, annual_rate: float, months: int) -> float:
    """What money invested today is worth after `months`, compounded monthly."""
    _check(months, amount, annual_rate)
    return amount * (1 + annual_rate / 12) ** months


def fv_sip_months(monthly: float, annual_rate: float, months: int) -> float:
    """What `monthly`, invested at the end of each month, grows to after `months`."""
    _check(months, monthly, annual_rate)
    return monthly * _sip_factor(annual_rate / 12, months)


def monthly_needed_months(goal: float, annual_rate: float, months: int) -> float:
    """The exact monthly investment, made at each month's end, that reaches `goal`
    after `months`. Unrounded: use `round_up_to` before showing it."""
    _check(months, goal, annual_rate)
    if months == 0:
        raise ValueError("a goal must be at least a month away")
    return goal / _sip_factor(annual_rate / 12, months)


def emi(principal: float, annual_rate: float, months: int) -> float:
    """The fixed monthly repayment of a loan over `months` (reducing balance)."""
    _check(months, principal, annual_rate)
    if months == 0:
        raise ValueError("a loan must last at least a month")
    rate = annual_rate / 12
    if rate == 0:
        return principal / months
    growth = (1 + rate) ** months
    return principal * rate * growth / (growth - 1)


def sip_value(monthly: float, annual_rate: float, years: int) -> int:
    """What a fixed monthly investment grows to, with monthly compounding."""
    months = years * 12
    if months <= 0:
        return 0
    return int(fv_sip_months(monthly, annual_rate, months))


def monthly_needed(goal: float, annual_rate: float, years: int) -> int:
    """The monthly investment that reaches `goal` in `years`. Rounds down, as the
    recommendation examples always have; goal plans use `monthly_needed_months`."""
    months = years * 12
    if months <= 0:
        return int(goal)
    return int(monthly_needed_months(goal, annual_rate, months))


def grow(amount: float, annual_rate: float, years: int) -> int:
    """Lump-sum growth compounded yearly. Goal plans use `fv_lump_sum_months`,
    which compounds monthly like the monthly-investment helpers."""
    return int(amount * (1 + annual_rate) ** years)


def yearly_earnings(amount: float, annual_rate: float) -> int:
    return int(amount * annual_rate)
