"""The arithmetic and assumptions behind the 'how your money can grow' examples.

Every rate below is an **illustrative assumption**, not a forecast or a quote:
real rates move, and market-linked returns can be negative in any year. They
are kept in this one place, and always shown to the user next to the numbers
they produce, so they can be reviewed and updated without touching any advice.
"""

# Annual rates used in examples.
SAVINGS_ACCOUNT_RATE = 0.03  # a typical bank savings account
SAFE_RATE = 0.065  # fixed deposits, liquid/debt funds, small-savings schemes
GROWTH_RATE = 0.10  # long-term, equity-oriented investing: not guaranteed
INFLATION = 0.06  # how fast everyday costs tend to rise

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


def round_to(amount: float, step: int) -> int:
    return int(round(amount / step) * step)


def sip_value(monthly: float, annual_rate: float, years: int) -> int:
    """What a fixed monthly investment grows to, with monthly compounding."""
    months = years * 12
    if months <= 0:
        return 0
    rate = annual_rate / 12
    return int(monthly * (((1 + rate) ** months - 1) / rate))


def monthly_needed(goal: float, annual_rate: float, years: int) -> int:
    """The monthly investment that reaches `goal` in `years`."""
    months = years * 12
    if months <= 0:
        return int(goal)
    rate = annual_rate / 12
    return int(goal / (((1 + rate) ** months - 1) / rate))


def grow(amount: float, annual_rate: float, years: int) -> int:
    return int(amount * (1 + annual_rate) ** years)


def yearly_earnings(amount: float, annual_rate: float) -> int:
    return int(amount * annual_rate)
