"""
Interest under sections 234A/234B/234C and the late-filing fee under 234F.

Conventions (Income Tax Act / Rule 119A):
- Interest is simple, 1% per month or part of a month.
- The amount interest is charged on is rounded DOWN to the nearest Rs 100.
- When self-assessment tax is paid part-way through a period, interest runs
  on the full shortfall up to (and including) the month of payment, then on
  the reduced amount from the following month.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from app.modules.itr.rules import ItrYearRules

ZERO = Decimal("0")
ONE_PERCENT = Decimal("0.01")


@dataclass(frozen=True)
class Payment:
    paid_on: date
    amount: Decimal


def round_down_to_100(amount: Decimal) -> Decimal:
    if amount <= 0:
        return ZERO
    return (amount // 100) * 100


def months_or_part(start: date, end: date) -> int:
    """Number of calendar months (counting a part month as a full month)
    from `start` to `end`, both inclusive. Zero if `end` is before `start`."""
    if end < start:
        return 0
    return (end.year - start.year) * 12 + (end.month - start.month) + 1


def _first_of_next_month(day: date) -> date:
    return (day.replace(day=1) + timedelta(days=32)).replace(day=1)


def _running_interest(outstanding: Decimal, period_start: date, end: date, payments: list[Payment]) -> Decimal:
    """1% per month on `outstanding` from `period_start` to `end`, reducing
    the outstanding amount as each payment (within the period) is made."""
    interest = ZERO
    for payment in sorted(payments, key=lambda p: p.paid_on):
        if outstanding <= 0:
            return interest
        if payment.paid_on < period_start or payment.paid_on > end:
            continue
        interest += round_down_to_100(outstanding) * ONE_PERCENT * months_or_part(period_start, payment.paid_on)
        outstanding -= payment.amount
        period_start = _first_of_next_month(payment.paid_on)
    if outstanding > 0:
        interest += round_down_to_100(outstanding) * ONE_PERCENT * months_or_part(period_start, end)
    return interest


def interest_234a(
    tax_after_credits: Decimal,
    self_assessment_payments: list[Payment],
    filing_date: date,
    rules: ItrYearRules,
) -> Decimal:
    """Late filing. `tax_after_credits` is the tax liability reduced by TDS,
    TCS and advance tax. Self-assessment tax paid on or before the due date
    reduces the base; later payments reduce it from the month after payment."""
    if filing_date <= rules.due_date:
        return ZERO

    outstanding = tax_after_credits - sum(
        (p.amount for p in self_assessment_payments if p.paid_on <= rules.due_date), ZERO
    )
    later = [p for p in self_assessment_payments if p.paid_on > rules.due_date]
    return _running_interest(outstanding, rules.due_date + timedelta(days=1), filing_date, later)


def interest_234b(
    assessed_tax: Decimal,
    advance_tax_paid: Decimal,
    self_assessment_payments: list[Payment],
    filing_date: date,
    rules: ItrYearRules,
) -> Decimal:
    """Default in advance tax. Applies only when assessed tax (liability less
    TDS/TCS) is at least the threshold and advance tax paid is below 90% of it.
    Runs from 1 April of the assessment year."""
    if assessed_tax < rules.interest_threshold_234b_234c:
        return ZERO
    if advance_tax_paid >= assessed_tax * Decimal("0.90"):
        return ZERO

    start = rules.fy_end + timedelta(days=1)
    return _running_interest(assessed_tax - advance_tax_paid, start, filing_date, self_assessment_payments)


# (installment due date, cumulative % due, safe-harbour %, months of interest)
def _installments(rules: ItrYearRules) -> list[tuple[date, Decimal, Decimal | None, int]]:
    fy = rules.fy_start.year
    return [
        (date(fy, 6, 15), Decimal("0.15"), Decimal("0.12"), 3),
        (date(fy, 9, 15), Decimal("0.45"), Decimal("0.36"), 3),
        (date(fy, 12, 15), Decimal("0.75"), None, 3),
        (date(fy + 1, 3, 15), Decimal("1.00"), None, 1),
    ]


def interest_234c(
    assessed_tax: Decimal,
    advance_tax_payments: list[Payment],
    rules: ItrYearRules,
) -> Decimal:
    """Deferment of advance tax installments.

    Simplification (disclosed): the relief for income that first arose after
    an installment date (e.g. dividends, per the 234C proviso) is not
    applied — 234C is computed on the full assessed tax. This can only
    overstate, never understate, the interest."""
    if assessed_tax < rules.interest_threshold_234b_234c:
        return ZERO

    interest = ZERO
    for due_on, cumulative_rate, safe_harbour_rate, months in _installments(rules):
        paid_by_due_date = sum((p.amount for p in advance_tax_payments if p.paid_on <= due_on), ZERO)
        if safe_harbour_rate is not None and paid_by_due_date >= assessed_tax * safe_harbour_rate:
            continue
        shortfall = assessed_tax * cumulative_rate - paid_by_due_date
        interest += round_down_to_100(shortfall) * ONE_PERCENT * months
    return interest


def fee_234f(total_income: Decimal, basic_exemption_limit: Decimal, filing_date: date, rules: ItrYearRules) -> Decimal:
    if filing_date <= rules.due_date:
        return ZERO
    if total_income <= basic_exemption_limit:
        return ZERO
    if total_income <= rules.fee_234f_small_income_limit:
        return rules.fee_234f_small
    return rules.fee_234f_large
