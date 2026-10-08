"""
Tax Planning's own recommendation rules — separate from
app.modules.recommendations.rules (which drives the general /recommendations
page), but built on the exact same shared pieces: Facts, the Recommendation
schema, and the same source-attribution wording. No parallel context model.

Scoped to what's specific to pacing deductions over the rest of the
financial year — whether chasing old-regime deductions still pays off,
which section needs attention first, and whether time is running out —
rather than duplicating the general tax-saving/life-stage rules.
"""

from app.modules.planning.schemas import PlanningSectionOut, RegimePosition
from app.modules.recommendations.facts import Facts
from app.modules.recommendations.money import format_inr
from app.modules.recommendations.rules import SOURCE_BASIS
from app.modules.recommendations.schemas import Recommendation


def _missing_dob(facts: Facts) -> Recommendation | None:
    if facts.declared is None or facts.age is not None:
        return None
    return Recommendation(
        id="planning_missing_dob",
        category="tax_saving",
        level=1,
        basis="General guidance",
        title="Add your date of birth",
        description=(
            "Section 80D's limit is higher for senior citizens — without a date of birth on "
            "file, this plan assumes the general limit for you."
        ),
        reason="Your 80D headroom could be understated if you qualify for the senior citizen limit.",
        action_label="Add date of birth",
        action_href="/profile",
    )


def _regime_fit_caution(
    facts: Facts, regime_position: RegimePosition | None, sections: list[PlanningSectionOut]
) -> Recommendation | None:
    if regime_position is None or regime_position.recommended_regime != "new":
        return None
    if sum(section.headroom for section in sections) == 0:
        return None
    basis = SOURCE_BASIS[facts.declared.source] if facts.declared else "General guidance"
    return Recommendation(
        id="planning_new_regime_fit",
        category="tax_saving",
        level=2 if facts.declared else 1,
        basis=basis,
        title="The new regime currently looks cheaper for you",
        description=(
            f"It's ahead by {format_inr(regime_position.difference)}, and the sections below "
            "only reduce tax under the old regime."
        ),
        reason=(
            "Filling this headroom won't lower your tax unless switching to the old regime would "
            "also save more overall — worth comparing both before investing to chase a deduction."
        ),
        action_label="Compare regimes",
        action_href="/tax-comparison",
    )


def _most_urgent_section(sections: list[PlanningSectionOut], months_remaining: int) -> Recommendation | None:
    actionable = [section for section in sections if section.monthly_target > 0]
    if not actionable:
        return None
    top = max(actionable, key=lambda section: section.monthly_target)
    return Recommendation(
        id="planning_priority_section",
        category="tax_saving",
        level=2,
        basis="Based on your current headroom",
        title=f"Start with {top.label}",
        description=(
            f"It needs the biggest commitment — about {format_inr(top.monthly_target)} a month for "
            f"the {months_remaining} {'month' if months_remaining == 1 else 'months'} left — to use "
            f"the full {format_inr(top.cap)} limit."
        ),
        reason="Tackling the tightest timeline first avoids a last-minute scramble in March.",
        action_label="See where this can go",
        action_href="/tax-planning",
    )


def _time_pressure(sections: list[PlanningSectionOut], months_remaining: int) -> Recommendation | None:
    if months_remaining > 2:
        return None
    total_headroom = sum(section.headroom for section in sections)
    if total_headroom == 0:
        return None
    return Recommendation(
        id="planning_time_pressure",
        category="tax_saving",
        level=2,
        basis="Based on the financial year calendar",
        title=f"Only {months_remaining} {'month' if months_remaining == 1 else 'months'} left this financial year",
        description=f"{format_inr(total_headroom)} of deduction headroom is still unused across your sections.",
        reason="Most of these investments need to be made before 31 March to count for this year.",
        action_label="Review your sections",
        action_href="/tax-planning",
    )


def build_planning_recommendations(
    facts: Facts,
    sections: list[PlanningSectionOut],
    regime_position: RegimePosition | None,
    months_remaining: int,
) -> list[Recommendation]:
    candidates = [
        _regime_fit_caution(facts, regime_position, sections),
        _time_pressure(sections, months_remaining),
        _most_urgent_section(sections, months_remaining),
        _missing_dob(facts),
    ]
    return [rec for rec in candidates if rec is not None]
