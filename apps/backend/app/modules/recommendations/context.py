"""Optional financial context for personalising life-stage advice.

Read-only. Draws on whatever the user has already entered, from either the
ITR filing draft or their latest tax comparison, preferring the most recently
updated source that has income in it. Never creates anything; with no usable
source the advice stays age-based.
"""

from dataclasses import dataclass
from datetime import datetime

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.itr.models import ItrFiling
from app.modules.itr.schemas import Health80DDraft, ItrDraftData
from app.modules.tax.models import TaxComparisonSnapshot
from app.modules.users.models import User


def _health_80d_amount(bucket: Health80DDraft) -> int:
    """Best-effort rupee estimate, not filing-precision: premiums + preventive
    checkup, uncapped here (the planning module applies the real cap).
    Mirrors but doesn't call the private `_health()` in itr/computation.py,
    which is tightly coupled to the full computation pipeline."""
    return sum(policy.premium for policy in bucket.policies) + bucket.preventive_checkup


@dataclass(frozen=True)
class FinancialContext:
    source: str  # "itr_filing" | "tax_comparison"
    annual_income: int
    section_80c_total: int
    section_80ccd_1b: int
    claims_health_self: bool
    # None when the source doesn't say (the tax comparison has no parents' 80D).
    claims_health_parents: bool | None
    section_80d_total: int
    home_loan_interest: int


def _from_itr_filing(db: Session, user: User) -> tuple[datetime, FinancialContext] | None:
    filing = db.scalar(
        select(ItrFiling).where(ItrFiling.user_id == user.id).order_by(ItrFiling.assessment_year.desc()).limit(1)
    )
    if filing is None:
        return None

    try:
        draft = ItrDraftData.model_validate(filing.data)
    except ValidationError:
        return None

    salary = draft.salary
    annual_income = salary.salary_17_1 + salary.perquisites_17_2 + salary.profits_17_3
    if annual_income <= 0:
        # An untouched draft carries no signal worth personalising on.
        return None

    return filing.updated_at, FinancialContext(
        source="itr_filing",
        annual_income=annual_income,
        section_80c_total=sum(item.amount for item in draft.deductions.section_80c),
        section_80ccd_1b=draft.deductions.section_80ccd_1b,
        claims_health_self=draft.deductions.health_self.claiming,
        claims_health_parents=draft.deductions.health_parents.claiming,
        section_80d_total=(
            _health_80d_amount(draft.deductions.health_self) + _health_80d_amount(draft.deductions.health_parents)
        ),
        home_loan_interest=sum(prop.interest_on_loan for prop in draft.house_properties),
    )


def _from_tax_comparison(db: Session, user: User) -> tuple[datetime, FinancialContext] | None:
    snapshot = db.scalar(select(TaxComparisonSnapshot).where(TaxComparisonSnapshot.user_id == user.id))
    if snapshot is None or snapshot.gross_total_income <= 0:
        return None

    return snapshot.updated_at, FinancialContext(
        source="tax_comparison",
        annual_income=snapshot.gross_total_income,
        section_80c_total=snapshot.section_80c,
        section_80ccd_1b=snapshot.nps_contribution,
        claims_health_self=snapshot.section_80d > 0,
        claims_health_parents=None,
        section_80d_total=snapshot.section_80d,
        home_loan_interest=snapshot.home_loan_interest,
    )


def load_financial_context(db: Session, user: User) -> FinancialContext | None:
    candidates = [c for c in (_from_itr_filing(db, user), _from_tax_comparison(db, user)) if c is not None]
    if not candidates:
        return None
    return max(candidates, key=lambda candidate: candidate[0])[1]
