"""The rule set. Each rule looks at the user's Facts and returns zero or more
recommendations; `engine.run` collects them. One rule covers one topic and
adapts its wording to the best data available, so a topic never shows up
twice (e.g. once generic and once personal).

No specific products or funds are recommended.
"""

from collections.abc import Callable
from decimal import Decimal

from app.modules.itr.rules import AY_2026_27
from app.modules.recommendations.document_rules import ais_income_gap, form16_deductions, hra_claim, tds_vs_tax
from app.modules.recommendations.facts import Facts
from app.modules.recommendations.money import format_inr
from app.modules.recommendations.profile import EmployeeCategory
from app.modules.recommendations.schemas import Recommendation
from app.modules.recommendations.templates import SECTION_80C_CAP, build_recommendations
from app.modules.tax import calculator
from app.modules.tax.age import resolve_age_category
from app.modules.tax.rules.registry import get_tax_rules

Rule = Callable[[Facts], list[Recommendation]]

_SOURCE_BASIS = {
    "itr_filing": "Based on your ITR filing",
    "tax_comparison": "Based on your latest tax comparison",
}


def _percent(rate: Decimal) -> int:
    return int(rate * 100)


def _declared_basis(facts: Facts) -> str:
    assert facts.declared is not None
    return _SOURCE_BASIS[facts.declared.source]


# ---------------------------------------------------------------------------
# Tax-saving
# ---------------------------------------------------------------------------


def regime_choice(facts: Facts) -> list[Recommendation]:
    base = dict(
        id="tax_regime_choice",
        category="tax_saving",
        action_label="Compare regimes",
        action_href="/tax-comparison",
    )

    regime = facts.declared.regime if facts.declared else None
    if regime is not None:
        if regime.better == "either":
            title = "Both tax regimes cost you about the same"
            description = f"Your estimated tax is {format_inr(regime.new_tax)} under either regime."
            reason = "Your deductions roughly cancel out the new regime's lower slab rates."
        elif regime.better == "new":
            title = "The new regime looks cheaper for you"
            description = f"It would save an estimated {format_inr(regime.difference)} compared with the old regime."
            reason = "Your deductions are below the point where the old regime's deductions outweigh its higher rates."
        else:
            title = "The old regime looks cheaper for you"
            description = f"It would save an estimated {format_inr(regime.difference)} compared with the new regime."
            reason = "Your deductions (such as 80C, 80D and HRA) outweigh the old regime's higher rates."
        return [Recommendation(**base, level=2, basis=_declared_basis(facts), title=title,
                               description=description, reason=reason)]

    # No regime comparison available (e.g. the old regime is closed for a late
    # ITR), so estimate the new-regime tax from the best income figure we have.
    declared = facts.declared
    income = declared.annual_income if declared else facts.expected_income
    year_rules = get_tax_rules(facts.tax_year)
    if income and year_rules is not None:
        age_category = resolve_age_category(facts.date_of_birth, facts.tax_year)
        tax = int(calculator.calculate_new_regime(Decimal(income), age_category, year_rules).total_tax_payable)
        description = (
            f"At about {format_inr(income)} a year you'd likely owe no income tax under the new regime "
            "(Section 87A rebate)."
            if tax == 0
            else f"At about {format_inr(income)} a year, your estimated tax under the new regime is "
            f"{format_inr(tax)}, before any deductions."
        )
        return [Recommendation(**base, level=2 if declared else 1,
                               basis=_declared_basis(facts) if declared else "Based on your expected income",
                               title="Estimate your tax under the new regime", description=description,
                               reason="This is an estimate from income alone. The old regime helps mainly when "
                               "your deductions are large, so compare both with your real figures.")]

    return [Recommendation(**base, level=1, basis="General guidance",
                           title="Understand the two tax regimes",
                           description="India has an old and a new tax regime, and which one costs less depends "
                           "on your income and deductions.",
                           reason="Picking the right one each year can save you thousands of rupees.")]


def section_80c(facts: Facts) -> list[Recommendation]:
    if "form16" in facts.documents.categories:
        return form16_deductions(facts)  # the Form 16 version of this topic

    base = dict(
        id="tax_80c",
        category="tax_saving",
        title="Make the most of Section 80C",
        action_label="See eligible instruments",
        action_href="/tax-comparison",
    )

    declared = facts.declared
    if declared is not None:
        headroom = max(0, SECTION_80C_CAP - declared.section_80c_total)
        description = (
            f"You have {format_inr(headroom)} of your {format_inr(SECTION_80C_CAP)} Section 80C limit unused."
            if headroom
            else "You've used your full Section 80C limit."
        )
        reason = "80C deductions only count if you choose the old regime."
        if declared.regime is not None and declared.regime.better == "new":
            reason += " The new regime currently looks cheaper for you, so this matters less."
        return [Recommendation(**base, level=2, basis=_declared_basis(facts), description=description, reason=reason)]

    return [Recommendation(**base, level=1, basis="General guidance",
                           description=f"Section 80C lets you deduct up to {format_inr(SECTION_80C_CAP)} a year "
                           "(for example EPF, PPF, ELSS and life insurance premiums).",
                           reason="It only applies under the old regime, so it's worth planning early in the year.")]


def employer_nps(facts: Facts) -> list[Recommendation]:
    rules = AY_2026_27
    new_rate = _percent(rules.rate_80ccd_2_new)
    if facts.employee_category == EmployeeCategory.GOVERNMENT:
        description = (
            f"Your employer's NPS contribution is deductible up to {_percent(rules.rate_80ccd_2_govt)}% of your "
            "basic salary plus DA under Section 80CCD(2), in both regimes."
        )
        basis = "Based on your employee category"
    else:
        description = (
            "If your employer offers NPS, their contribution is deductible under Section 80CCD(2): up to "
            f"{new_rate}% of basic salary plus DA in the new regime, and {_percent(rules.rate_80ccd_2_old_private)}% "
            "in the old regime."
        )
        basis = "Based on your employee category" if facts.employee_category else "General guidance"

    return [Recommendation(id="tax_employer_nps", category="tax_saving", level=1, basis=basis,
                           title="Ask about employer NPS", description=description,
                           reason="It's one of the few deductions that still applies under the new regime.",
                           action_label="Compare regimes", action_href="/tax-comparison")]


# ---------------------------------------------------------------------------
# Life-stage
# ---------------------------------------------------------------------------


def life_stage(facts: Facts) -> list[Recommendation]:
    if facts.stage is None:
        return []

    declared = facts.declared
    if declared is None:
        level, basis = 1, "Based on your age"
    else:
        level, basis = 2, _declared_basis(facts).replace("Based on", "Based on your age and", 1)
    return [
        Recommendation(**rec.model_dump(), category="life_stage", level=level, basis=basis)
        for rec in build_recommendations(facts.stage, declared)
    ]


RULES: list[Rule] = [regime_choice, tds_vs_tax, section_80c, ais_income_gap, hra_claim, employer_nps, life_stage]
