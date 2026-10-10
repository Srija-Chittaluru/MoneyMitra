from datetime import date

from sqlalchemy.orm import Session

from app.modules.deposits.rates import CHECKED_ON, PROVIDERS, TENURES
from app.modules.deposits.schemas import RdRateOut, RdRatesOut, TenureOut
from app.modules.recommendations.context import load_financial_context
from app.modules.recommendations.stages import calculate_age
from app.modules.users.models import User

SENIOR_AGE = 60
DISCLAIMER = (
    "Rates are each provider's published rates on the date shown, for deposits under ₹3 crore, and can change. "
    "Interest is compounded quarterly and taxed at your slab rate; TDS applies once interest crosses ₹50,000 a year "
    "(₹1 lakh for senior citizens). Check the current rate with the bank before you open an RD."
)


def maturity(monthly: int, annual_rate: float, months: int) -> int:
    """What an RD pays at maturity, compounded quarterly as Indian banks do:
    each instalment earns interest for the months it stays deposited."""
    quarterly = annual_rate / 400
    return round(sum(monthly * (1 + quarterly) ** (remaining / 3) for remaining in range(months, 0, -1)))


def _income(db: Session, user: User, today: date) -> tuple[int | None, str | None]:
    context = load_financial_context(db, user, today)
    if context is not None:
        return context.annual_income, "your ITR filing" if context.source == "itr_filing" else "your tax comparison"
    if user.expected_annual_income:
        return user.expected_annual_income, "your expected income"
    return None, None


def get_rd_rates(db: Session, user: User, today: date | None = None) -> RdRatesOut:
    today = today or date.today()
    rates = [
        RdRateOut(
            provider_id=p.id, provider_name=p.name, kind=p.kind, tenure=tenure,
            customer_category=category, annual_rate=rate, min_monthly=p.min_monthly,
            effective_date=p.effective_date, source=p.source, source_url=p.source_url,
        )
        for p in PROVIDERS
        for category, table in (("general", p.general), ("senior_citizen", p.senior))
        for tenure, rate in table.items()
    ]

    age = calculate_age(user.date_of_birth, today) if user.date_of_birth else None
    income, basis = _income(db, user, today)
    suggested = max(500, round(income / 12 * 0.05 / 500) * 500) if income else None

    return RdRatesOut(
        tenures=[TenureOut(id=t, label=label, months=months) for t, (label, months) in TENURES.items()],
        rates=rates,
        is_senior=age is not None and age >= SENIOR_AGE,
        suggested_monthly=suggested,
        suggestion_basis=f"About 5% of your monthly income, from {basis}" if suggested else None,
        checked_on=CHECKED_ON,
        disclaimer=DISCLAIMER,
    )
