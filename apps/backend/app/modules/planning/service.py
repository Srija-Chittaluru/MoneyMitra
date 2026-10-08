"""
Tax planning: how much deduction headroom is left this financial year, and
what that means per remaining month — so the answer arrives while there's
still time to act on it, not at filing time when the year is already over.

HRA is deliberately excluded from the per-section list below: it has no flat
cap to pace an investment against (it's driven by rent actually paid, not a
contribution the person can add to), so a "monthly target" wouldn't mean
anything for it. The Tax Comparison deduction checklist still shows it;
here it would just be a prose-only entry. It does count in the regime
estimate, which uses the exemption computed from the ITR draft.

Years: the plan is for the *current* financial year, but the saved figures
(an ITR draft, a tax comparison) are often for the previous one. Last year's
investments are not this year's progress, so they are shown as a reference
and the headroom restarts from zero; only home loan interest, which repeats
by itself, is carried forward.
"""

from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.planning.fy import current_financial_year
from app.modules.planning.fy import months_remaining as _months_remaining
from app.modules.planning.rules import build_planning_recommendations
from app.modules.planning.schemas import InstrumentOptionOut, PlanningSectionOut, RegimePosition, TaxPlanOut
from app.modules.recommendations.context import FinancialContext
from app.modules.recommendations.facts import build_facts
from app.modules.recommendations.money import format_inr
from app.modules.recommendations.stages import STAGE_LABELS
from app.modules.resources.content import DEDUCTION_LIMITS
from app.modules.tax import service as tax_service
from app.modules.tax.instruments import INSTRUMENT_OPTIONS, SECTION_LABELS, DeductionSection
from app.modules.tax.schemas import TaxComparisonInput
from app.modules.users.models import User

# Single source of truth for the cap amounts: app.modules.resources.content.
_LIMITS = {limit.section: limit for limit in DEDUCTION_LIMITS}

_SENIOR_CITIZEN_AGE = 60

# What the regime estimate leaves out. It counts salary and interest/dividend
# income, HRA, 80C, 80D (yourself and your parents), home loan interest and NPS
# under 80CCD(1B), but not the items below, which the tax calculator can't take
# yet.
_REGIME_CAVEAT = (
    "This estimate leaves out rental income, your employer's NPS contribution (80CCD(2)) and other "
    "deductions such as 80E or 80TTA."
)


def _is_senior(age: int | None, includes_senior_flag: bool) -> bool:
    return includes_senior_flag or (age is not None and age >= _SENIOR_CITIZEN_AGE)


def _regime_position(
    context: FinancialContext, fy_label: str, date_of_birth: date | None, age: int | None
) -> RegimePosition | None:
    limit_80d = _LIMITS[DeductionSection.SECTION_80D]
    self_cap = (
        limit_80d.limit_senior if _is_senior(age, context.self_cover_includes_senior) else limit_80d.limit_general
    )
    parents_cap = limit_80d.limit_senior if context.parents_are_senior else limit_80d.limit_general

    comparison_input = TaxComparisonInput(
        tax_year=fy_label,
        gross_total_income=context.annual_income + (context.other_income_total or 0),
        date_of_birth=date_of_birth,
        section_80c=context.section_80c_total,
        section_80d=min(context.section_80d_self, self_cap),
        hra_exemption=context.hra_exemption,
        home_loan_interest=context.home_loan_interest,
        nps_contribution=context.section_80ccd_1b,
        # Parents' premiums have their own 80D limit, which the calculator's single
        # 80D field can't hold. Like 80D itself, it only counts under the old regime.
        other_deductions=min(context.section_80d_parents, parents_cap),
    )
    try:
        result = tax_service.calculate_comparison(comparison_input)
    except HTTPException:  # no tax rules for this financial year yet
        return None
    return RegimePosition(recommended_regime=result.recommended_regime, difference=result.difference)


def _section_plan(
    section: DeductionSection,
    cap: int,
    amount: int,
    months: int,
    *,
    is_current_year: bool,
    carries_forward: bool = False,
    note: str | None = None,
) -> PlanningSectionOut:
    """`amount` is what the saved figures hold for this section. It only counts
    as progress this year if the figures are for this year, or if the section
    repeats every year on its own (`carries_forward`, e.g. loan interest)."""
    counts_this_year = is_current_year or carries_forward
    declared = amount if counts_this_year else 0
    headroom = max(0, cap - declared)
    # Loan interest is a cost you pay, not something you can invest more in, so it has no pacing target.
    monthly_target = -(-headroom // months) if headroom and not carries_forward else 0  # ceiling division
    return PlanningSectionOut(
        section=section.value,
        label=SECTION_LABELS[section],
        cap=cap,
        declared_amount=declared,
        headroom=headroom,
        monthly_target=monthly_target,
        last_year_amount=amount if not is_current_year and not carries_forward and amount else None,
        carried_forward=carries_forward and not is_current_year and amount > 0,
        note=note,
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

    # Facts is the same context bundle the /recommendations engine builds from —
    # reusing it here (rather than loading FinancialContext a second, separate
    # way) keeps age/stage/declared-figures identical across both features.
    facts = build_facts(db, user, today)
    age = facts.age
    stage_label = STAGE_LABELS[facts.stage] if facts.stage else None

    context = facts.declared
    if context is None:
        return TaxPlanOut(
            has_data=False,
            fy_label=fy_label,
            fy_end=fy_end,
            months_remaining=months,
            age=age,
            stage_label=stage_label,
            context_source=None,
            data_fy_label=None,
            data_is_current_year=False,
            regime_position=None,
            regime_caveat=_REGIME_CAVEAT,
            sections=[],
            recommendations=[],
        )

    is_current_year = context.financial_year == fy_label
    year = dict(is_current_year=is_current_year)

    limit_80d = _LIMITS[DeductionSection.SECTION_80D]
    self_cap = (
        limit_80d.limit_senior
        if _is_senior(age, context.self_cover_includes_senior)
        else limit_80d.limit_general
    )
    parents_note = (
        f"Your parents' premiums ({format_inr(context.section_80d_parents)}) have their own limit, "
        "so they aren't counted here."
        if context.section_80d_parents
        else None
    )

    sections = [
        _section_plan(
            DeductionSection.SECTION_80C,
            _LIMITS[DeductionSection.SECTION_80C].limit_general,
            context.section_80c_total,
            months,
            **year,
        ),
        _section_plan(
            DeductionSection.SECTION_80D, self_cap, context.section_80d_self, months, note=parents_note, **year
        ),
        _section_plan(
            DeductionSection.SECTION_24B,
            _LIMITS[DeductionSection.SECTION_24B].limit_general,
            context.home_loan_interest,
            months,
            carries_forward=True,
            **year,
        ),
        _section_plan(
            DeductionSection.SECTION_80CCD_1B,
            _LIMITS[DeductionSection.SECTION_80CCD_1B].limit_general,
            context.section_80ccd_1b,
            months,
            **year,
        ),
    ]

    caveat = _REGIME_CAVEAT
    if not is_current_year and context.financial_year:
        caveat = (
            f"This uses your FY {context.financial_year} figures, assuming they stay the same this year. " + caveat
        )

    regime_position = _regime_position(context, fy_label, user.date_of_birth, age)

    return TaxPlanOut(
        has_data=True,
        fy_label=fy_label,
        fy_end=fy_end,
        months_remaining=months,
        age=age,
        stage_label=stage_label,
        context_source=context.source,
        data_fy_label=context.financial_year,
        data_is_current_year=is_current_year,
        regime_position=regime_position,
        regime_caveat=caveat,
        sections=sections,
        recommendations=build_planning_recommendations(facts, sections, regime_position, months),
    )
