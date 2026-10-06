"""Stage-specific advice templates.

Each builder returns the recommendations for one life stage. Without a
FinancialContext the advice is general and age-based; with one, the wording
is made specific to the user's own numbers. No specific products or funds are
recommended.
"""

from app.modules.recommendations.context import FinancialContext
from app.modules.recommendations.money import format_inr
from app.modules.recommendations.schemas import LifeStageRecommendation
from app.modules.recommendations.stages import LifeStage

SECTION_80C_CAP = 150_000
SECTION_80CCD_1B_CAP = 50_000
SENIOR_CITIZEN_AGE = 60


def _health_cover(ctx: FinancialContext | None, *, include_parents: bool) -> tuple[str, str]:
    """(description, reason) for the health-insurance recommendation."""
    if ctx is None:
        return (
            "Check that your health cover matches your income and responsibilities."
            if include_parents
            else "Get your own health insurance policy while premiums are low.",
            "Medical costs are one of the biggest threats to savings, and premiums rise with age."
            if include_parents
            else "Buying early keeps premiums low and avoids waiting periods for pre-existing conditions.",
        )
    if not ctx.claims_health_self:
        return (
            "You haven't entered any health insurance premium under Section 80D.",
            "A health policy protects your savings from medical bills, and premiums are "
            "deductible under 80D in the old regime.",
        )
    if include_parents and ctx.claims_health_parents is False:
        return (
            "You claim 80D for yourself, but not for your parents' health insurance.",
            "Cover for parents is a separate 80D limit, and medical costs rise sharply with age.",
        )
    return (
        "You already claim health insurance under Section 80D. Review whether the cover still fits.",
        "Cover set years ago may no longer match medical costs or your family's needs.",
    )


def _build_career_start(ctx: FinancialContext | None) -> list[LifeStageRecommendation]:
    if ctx is not None:
        monthly = ctx.annual_income // 12
        emergency_description = (
            f"Your salary income is about {format_inr(monthly)} a month. "
            "Aim to keep 6 months of your expenses in a liquid fund or savings account."
        )
    else:
        emergency_description = "Keep 6 months of expenses in a liquid fund or savings account."

    health_description, health_reason = _health_cover(ctx, include_parents=False)

    if ctx is not None:
        headroom = max(0, SECTION_80C_CAP - ctx.section_80c_total)
        invest_description = (
            f"You have {format_inr(headroom)} of Section 80C headroom this year."
            if headroom
            else "You've used your full Section 80C limit this year."
        )
    else:
        invest_description = "Start a regular investment habit, even with a small monthly amount."

    return [
        LifeStageRecommendation(
            id="career_start_emergency_fund",
            title="Build a 6-month emergency fund",
            description=emergency_description,
            reason="You're early in your career, so a safety net matters more than optimizing returns right now.",
            action_label="Plan your finances",
            action_href="/finance",
        ),
        LifeStageRecommendation(
            id="career_start_health_cover",
            title="Get your own health insurance",
            description=health_description,
            reason=health_reason,
            action_label="Review deductions",
            action_href="/tax-comparison",
        ),
        LifeStageRecommendation(
            id="career_start_start_investing",
            title="Start investing early",
            description=invest_description,
            reason="Time in the market is your biggest advantage; small amounts started early compound the most.",
            action_label="Compare tax regimes",
            action_href="/tax-comparison",
        ),
    ]


def _build_mid_career(ctx: FinancialContext | None) -> list[LifeStageRecommendation]:
    health_description, health_reason = _health_cover(ctx, include_parents=True)

    if ctx is not None:
        nps_headroom = max(0, SECTION_80CCD_1B_CAP - ctx.section_80ccd_1b)
        retirement_description = (
            f"You haven't used the extra {format_inr(SECTION_80CCD_1B_CAP)} NPS deduction under Section 80CCD(1B)."
            if nps_headroom == SECTION_80CCD_1B_CAP
            else f"You have {format_inr(nps_headroom)} of Section 80CCD(1B) headroom left."
            if nps_headroom
            else "You've used your full Section 80CCD(1B) NPS deduction."
        )
    else:
        retirement_description = "Check you're saving enough each month to reach your retirement goal."

    return [
        LifeStageRecommendation(
            id="mid_career_health_cover",
            title="Review your health insurance cover",
            description=health_description,
            reason=health_reason,
            action_label="Review deductions",
            action_href="/tax-comparison",
        ),
        LifeStageRecommendation(
            id="mid_career_life_cover",
            title="Check your life insurance cover",
            description="If others depend on your income, make sure term cover is enough to replace it.",
            reason="Responsibilities such as family and loans usually peak in this stage.",
            action_label="See what qualifies",
            action_href="/tax-comparison",
        ),
        LifeStageRecommendation(
            id="mid_career_retirement_savings",
            title="Step up your retirement savings",
            description=retirement_description,
            reason="You have a few decades to retirement, so raising contributions now has the biggest effect.",
            action_label="Compare tax regimes",
            action_href="/tax-comparison",
        ),
    ]


def _build_pre_retirement(ctx: FinancialContext | None) -> list[LifeStageRecommendation]:
    health_description, health_reason = _health_cover(ctx, include_parents=True)

    return [
        LifeStageRecommendation(
            id="pre_retirement_capital_preservation",
            title="Shift toward capital preservation",
            description="Gradually rebalance from equity-heavy investments to safer instruments.",
            reason="As retirement approaches, protecting accumulated savings matters more than growth.",
            action_label="Review portfolio mix",
            action_href="/finance",
        ),
        LifeStageRecommendation(
            id="pre_retirement_health_cover",
            title="Secure health cover before you retire",
            description=health_description,
            reason=f"{health_reason} Premiums and waiting periods are easier to manage before age {SENIOR_CITIZEN_AGE}.",
            action_label="Review deductions",
            action_href="/tax-comparison",
        ),
        LifeStageRecommendation(
            id="pre_retirement_income_plan",
            title="Plan your retirement income",
            description="Work out how your savings will turn into a regular income once the salary stops.",
            reason=(
                "Senior citizens get higher tax thresholds and 80D limits from age "
                f"{SENIOR_CITIZEN_AGE}, so it helps to plan the switch in advance."
            ),
            action_label="Compare tax regimes",
            action_href="/tax-comparison",
        ),
    ]


_BUILDERS = {
    LifeStage.CAREER_START: _build_career_start,
    LifeStage.MID_CAREER: _build_mid_career,
    LifeStage.PRE_RETIREMENT: _build_pre_retirement,
}


def build_recommendations(stage: LifeStage, ctx: FinancialContext | None) -> list[LifeStageRecommendation]:
    return _BUILDERS[stage](ctx)
