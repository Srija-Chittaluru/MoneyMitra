"""
Tax planning: how much deduction headroom is left this financial year, and
what that means per remaining month — so the answer arrives while there's
still time to act on it, not at filing time when the year is already over.

HRA is deliberately excluded from the per-section list below: it has no flat
cap to pace an investment against (it's driven by rent actually paid, not a
contribution the person can add to), so a "monthly target" wouldn't mean
anything for it. The Tax Comparison deduction checklist still shows it;
here it would just be a prose-only entry.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.modules.planning.fy import current_financial_year
from app.modules.planning.fy import months_remaining as _months_remaining
from app.modules.planning.schemas import InstrumentOptionOut, PlanningSectionOut, RegimePosition, TaxPlanOut
from app.modules.recommendations.context import FinancialContext, load_financial_context
from app.modules.recommendations.stages import STAGE_LABELS, calculate_age, resolve_life_stage
from app.modules.resources.content import DEDUCTION_LIMITS
from app.modules.tax import service as tax_service
from app.modules.tax.instruments import INSTRUMENT_OPTIONS, SECTION_LABELS, DeductionSection
from app.modules.tax.schemas import TaxComparisonInput
from app.modules.users.models import User

# Single source of truth for the cap amounts: app.modules.resources.content.
_LIMITS = {limit.section: limit for limit in DEDUCTION_LIMITS}

_SENIOR_CITIZEN_AGE = 60

# The one real gap in this check: HRA isn't tracked in FinancialContext (it's
# computed from salary + rent in the full ITR pipeline, not a flat declared
# amount), so it's left out here rather than guessed at.
_REGIME_CAVEAT = (
    "This check excludes HRA, since it isn't tracked here the way the ITR filing computes it."
)


def _regime_position(
    context: FinancialContext, fy_label: str, date_of_birth: date | None
) -> RegimePosition:
    comparison_input = TaxComparisonInput(
        tax_year=fy_label,
        gross_total_income=context.annual_income,
        date_of_birth=date_of_birth,
        section_80c=context.section_80c_total,
        section_80d=context.section_80d_total,
        home_loan_interest=context.home_loan_interest,
        nps_contribution=context.section_80ccd_1b,
    )
    result = tax_service.calculate_comparison(comparison_input)
    return RegimePosition(recommended_regime=result.recommended_regime, difference=result.difference)


def _section_plan(
    section: DeductionSection, cap: int, declared: int, months: int
) -> PlanningSectionOut:
    headroom = max(0, cap - declared)
    monthly_target = -(-headroom // months) if headroom else 0  # ceiling division
    return PlanningSectionOut(
        section=section.value,
        label=SECTION_LABELS[section],
        cap=cap,
        declared_amount=declared,
        headroom=headroom,
        monthly_target=monthly_target,
        instruments=[
            InstrumentOptionOut(
                name=option.name,
                description=option.description,
                lock_in=option.lock_in,
                type=option.type,
                why=option.why,
                link=option.link,
            )
            for option in INSTRUMENT_OPTIONS[section]
        ],
    )


def get_tax_plan(db: Session, user: User, today: date | None = None) -> TaxPlanOut:
    today = today or date.today()
    fy_label, _fy_start, fy_end = current_financial_year(today)
    months = _months_remaining(today, fy_end)

    age = None
    stage_label = None
    if user.date_of_birth is not None:
        age = calculate_age(user.date_of_birth, today)
        stage_label = STAGE_LABELS[resolve_life_stage(age)]

    context = load_financial_context(db, user)
    if context is None:
        return TaxPlanOut(
            has_data=False,
            fy_label=fy_label,
            fy_end=fy_end,
            months_remaining=months,
            age=age,
            stage_label=stage_label,
            context_source=None,
            regime_position=None,
            regime_caveat=_REGIME_CAVEAT,
            sections=[],
        )

    section_80d_limit = _LIMITS[DeductionSection.SECTION_80D]
    section_80d_cap = (
        section_80d_limit.limit_senior
        if age is not None and age >= _SENIOR_CITIZEN_AGE
        else section_80d_limit.limit_general
    )

    sections = [
        _section_plan(
            DeductionSection.SECTION_80C,
            _LIMITS[DeductionSection.SECTION_80C].limit_general,
            context.section_80c_total,
            months,
        ),
        _section_plan(DeductionSection.SECTION_80D, section_80d_cap, context.section_80d_total, months),
        _section_plan(
            DeductionSection.SECTION_24B,
            _LIMITS[DeductionSection.SECTION_24B].limit_general,
            context.home_loan_interest,
            months,
        ),
        _section_plan(
            DeductionSection.SECTION_80CCD_1B,
            _LIMITS[DeductionSection.SECTION_80CCD_1B].limit_general,
            context.section_80ccd_1b,
            months,
        ),
    ]

    return TaxPlanOut(
        has_data=True,
        fy_label=fy_label,
        fy_end=fy_end,
        months_remaining=months,
        age=age,
        stage_label=stage_label,
        context_source=context.source,
        regime_position=_regime_position(context, fy_label, user.date_of_birth),
        regime_caveat=_REGIME_CAVEAT,
        sections=sections,
    )
