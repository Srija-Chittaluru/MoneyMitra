"""Estimated monthly take-home pay, for checking whether a goal fits.

Pure: callers pass in what they've already loaded (an ITR draft and its summary,
a tax comparison's financial context, the profile's expected income). Income tax
always comes from the existing tax calculations; nothing here recomputes it.

An estimate is (annual gross - income tax - professional tax) / 12. It leaves
out employee PF, NPS, insurance and other payroll deductions, which MoneyMitra
doesn't know, so real take-home is usually lower. Only a figure the user enters
is treated as their actual take-home.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum

from fastapi import HTTPException

from app.modules.itr.schemas import ItrDraftData, ItrSummary
from app.modules.planning.fy import current_financial_year, financial_year_of_assessment_year
from app.modules.recommendations.context import FinancialContext
from app.modules.recommendations.money import format_inr as inr
from app.modules.tax import service as tax_service
from app.modules.tax.schemas import TaxComparisonInput

# Article 276(2) of the Constitution caps professional tax at Rs 2,500 a year.
# Most states that levy it charge close to that and some charge nothing, so it's
# used, and disclosed, when the source doesn't say: take-home is never overstated
# by assuming zero. (The ITR's Rs 5,000 cap is the return's limit for the deduction.)
ESTIMATED_PROFESSIONAL_TAX = 2_500

SOURCE_LABELS = {
    "itr_filing": "ITR filing",
    "documents": "uploaded documents",
    "tax_comparison": "tax comparison",
    "profile": "expected income in your profile",
    "user": "the take-home pay you entered",
}

LEFT_OUT_NOTE = (
    "Employee PF, NPS, insurance and other deductions from your salary aren't included, so your actual "
    "take-home is likely to be lower."
)


class Reliability(StrEnum):
    CONFIRMED = "confirmed"  # the user's own monthly take-home figure
    ESTIMATED = "estimated"  # from this financial year's income and tax
    STALE = "stale"  # from an earlier financial year
    EXPECTED_ONLY = "expected_only"  # from the profile's expected income alone
    INCOMPLETE = "incomplete"  # a figure needed for the estimate couldn't be worked out
    UNAVAILABLE = "unavailable"  # nothing to go on


# Good enough to say whether a goal fits. Everything else asks the user to confirm.
RELIABLE = frozenset({Reliability.CONFIRMED, Reliability.ESTIMATED})

# When several sources are available, the best usable one wins; ties keep the caller's order.
_PREFERENCE = (
    Reliability.ESTIMATED,
    Reliability.STALE,
    Reliability.EXPECTED_ONLY,
    Reliability.INCOMPLETE,
)


@dataclass(frozen=True)
class IncomeEvidence:
    source: str  # a key of SOURCE_LABELS
    financial_year: str | None  # "2026-27"
    annual_gross: int
    annual_tax: int | None  # None when it couldn't be calculated
    annual_professional_tax: int | None  # None when the source doesn't say
    notes: tuple[str, ...] = ()


@dataclass(frozen=True)
class TakeHome:
    reliability: Reliability
    monthly: int | None  # None when there's nothing to estimate from
    source: str | None = None
    financial_year: str | None = None
    annual_gross: int | None = None
    annual_tax: int | None = None
    annual_professional_tax: int | None = None
    professional_tax_estimated: bool = False
    notes: list[str] = field(default_factory=list)

    @property
    def is_reliable(self) -> bool:
        return self.reliability in RELIABLE

    @property
    def source_label(self) -> str:
        return SOURCE_LABELS.get(self.source or "", "your details")


# ---------------------------------------------------------------------------
# Evidence from what MoneyMitra already has
# ---------------------------------------------------------------------------


def evidence_from_itr(draft: ItrDraftData, summary: ItrSummary, source: str = "itr_filing") -> IncomeEvidence | None:
    """From an ITR draft (saved, or built from documents) and its summary. Uses
    salary 17(1), the cash salary: perquisites are usually benefits, not pay.
    None when there's no salary to go on."""
    gross = draft.salary.salary_17_1
    if gross <= 0:
        return None
    selected = summary.selected
    notes = []
    if selected.gross_total_income > selected.income_from_salary:
        notes.append("Income tax covers everything in the return, not just salary, so it may be overstated here.")
    return IncomeEvidence(
        source=source,
        financial_year=financial_year_of_assessment_year(summary.assessment_year),
        annual_gross=gross,
        annual_tax=selected.gross_tax_liability,
        # Zero is the draft's default, so it can't be told apart from "not entered".
        annual_professional_tax=draft.salary.professional_tax or None,
        notes=tuple(notes),
    )


def evidence_from_tax_comparison(context: FinancialContext) -> IncomeEvidence:
    """From the financial context of the user's saved tax comparison."""
    if context.source != "tax_comparison":
        raise ValueError("expected a tax comparison context")
    regime = context.regime
    tax = min(regime.old_tax, regime.new_tax) if regime else None
    return IncomeEvidence(
        source="tax_comparison",
        financial_year=context.financial_year,
        annual_gross=context.annual_income,
        annual_tax=tax,
        annual_professional_tax=None,
        notes=(
            "Assumes you use the regime with less tax.",
            "The comparison has one income total, which may include income other than salary.",
        ),
    )


def evidence_from_expected_income(
    expected_annual_income: int, today: date, date_of_birth: date | None = None
) -> IncomeEvidence:
    """The profile's expected income, read as gross pay for this financial year,
    taxed with the existing calculator under the cheaper regime, no deductions."""
    financial_year = current_financial_year(today)[0]
    try:
        result = tax_service.calculate_comparison(
            TaxComparisonInput(
                tax_year=financial_year, gross_total_income=expected_annual_income, date_of_birth=date_of_birth
            )
        )
        tax = min(result.old_regime.total_tax_payable, result.new_regime.total_tax_payable)
    except HTTPException:  # tax rules for this year aren't available yet
        tax = None
    return IncomeEvidence(
        source="profile",
        financial_year=financial_year,
        annual_gross=expected_annual_income,
        annual_tax=tax,
        annual_professional_tax=None,
        notes=("Treats your expected income as pay before tax, with no deductions claimed.",),
    )


# ---------------------------------------------------------------------------
# Estimating take-home
# ---------------------------------------------------------------------------


def confirmed_take_home(monthly: int) -> TakeHome:
    if monthly <= 0:
        raise ValueError("take-home pay must be above zero")
    return TakeHome(Reliability.CONFIRMED, monthly, source="user")


def estimate_take_home(evidence: IncomeEvidence, today: date) -> TakeHome:
    base = {
        "source": evidence.source,
        "financial_year": evidence.financial_year,
        "annual_gross": evidence.annual_gross,
        "annual_tax": evidence.annual_tax,
    }
    label = SOURCE_LABELS[evidence.source]
    period = f"FY {evidence.financial_year}" if evidence.financial_year else "an unknown year"
    if evidence.annual_tax is None:
        return TakeHome(
            Reliability.INCOMPLETE, None, **base,
            notes=[f"We couldn't work out the income tax on the income in your {label} for {period}."],
        )

    estimated_pt = evidence.annual_professional_tax is None
    pt = ESTIMATED_PROFESSIONAL_TAX if estimated_pt else evidence.annual_professional_tax
    # Rounded down, so take-home is never overstated.
    monthly = (evidence.annual_gross - evidence.annual_tax - pt) // 12
    base |= {"annual_professional_tax": pt, "professional_tax_estimated": estimated_pt}

    notes = [
        f"Estimated from your {label} for {period}: {inr(evidence.annual_gross)} a year, less "
        f"{inr(evidence.annual_tax)} income tax and {inr(pt)} professional tax.",
        *evidence.notes,
        LEFT_OUT_NOTE,
    ]
    if estimated_pt:
        notes.append(
            f"Professional tax is assumed to be {inr(ESTIMATED_PROFESSIONAL_TAX)} a year, the most a state can "
            "charge. It may be less, or none, where you live."
        )
    if monthly <= 0:
        return TakeHome(Reliability.INCOMPLETE, None, **base, notes=notes)

    if evidence.source == "profile":
        reliability = Reliability.EXPECTED_ONLY
    elif evidence.financial_year != current_financial_year(today)[0]:
        reliability = Reliability.STALE
    else:
        reliability = Reliability.ESTIMATED
    return TakeHome(reliability, monthly, **base, notes=notes)


def resolve_take_home(
    today: date, evidence: Sequence[IncomeEvidence] = (), confirmed_monthly: int | None = None
) -> TakeHome:
    """The best take-home figure available: the user's own, else the most reliable
    estimate. Pass `evidence` most-preferred first."""
    if confirmed_monthly is not None:
        return confirmed_take_home(confirmed_monthly)
    estimates = [estimate_take_home(item, today) for item in evidence]
    for reliability in _PREFERENCE:
        for estimate in estimates:
            if estimate.reliability == reliability:
                return estimate
    return TakeHome(Reliability.UNAVAILABLE, None)
