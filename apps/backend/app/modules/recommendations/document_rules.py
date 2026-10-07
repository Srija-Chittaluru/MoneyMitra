"""Level 3 rules: advice drawn from the user's uploaded documents.

Where a topic is also covered by a lower-level rule (80C), the lower-level
rule defers to the version here, so the topic still appears only once.
"""

from app.modules.recommendations.facts import Facts
from app.modules.recommendations.money import format_inr
from app.modules.recommendations.schemas import Recommendation
from app.modules.recommendations.templates import SECTION_80C_CAP

# Smaller gaps are rounding noise, not worth a recommendation.
MIN_INCOME_GAP = 1_000


def _basis(facts: Facts) -> str:
    assert facts.documents is not None
    return f"From your {facts.documents.source_text}"


def tds_vs_tax(facts: Facts) -> list[Recommendation]:
    """Tax already deducted at source, against what the documents imply you owe."""
    docs = facts.documents
    if docs is None or docs.summary is None:
        return []
    # A payslip only covers part of the year, so it can't say whether TDS is enough.
    if not docs.categories & {"form16", "ais"}:
        return []

    candidates = [docs.summary.selected] + ([docs.summary.alternative] if docs.summary.alternative else [])
    best = min(candidates, key=lambda regime: regime.total_tax_and_interest)
    liability, paid = best.total_tax_and_interest, best.total_taxes_paid
    if liability == 0 and paid == 0:
        return []

    regime_name = "old" if best.regime == "old" else "new"
    base = dict(
        id="doc_tds_vs_tax",
        category="tax_saving",
        level=3,
        basis=_basis(facts),
        action_label="Review in ITR Filing",
        action_href="/itr-filing",
    )
    extras = " including interest and late fees" if liability > best.gross_tax_liability else ""
    figures = (
        f"{format_inr(paid)} of tax has been deducted at source against an estimated "
        f"{format_inr(liability)}{extras}"
    )
    if best.refund_due > 0:
        return [Recommendation(**base, title="You may get a tax refund",
                               description=f"{figures}, so you could get about {format_inr(best.refund_due)} back.",
                               reason=f"A refund is claimed by filing your return. This is an estimate under the "
                               f"{regime_name} regime, using only what your documents show.")]
    if best.balance_payable > 0:
        return [Recommendation(**base, title="You may owe more tax",
                               description=f"{figures}, which leaves about {format_inr(best.balance_payable)} to pay.",
                               reason=f"Tax deducted at source didn't cover everything. Paying before you file helps "
                               f"avoid interest. This is an estimate under the {regime_name} regime.")]
    return [Recommendation(**base, title="Your tax deducted covers what you owe",
                           description=f"{figures}, so little or nothing is left to pay.",
                           reason=f"This is an estimate under the {regime_name} regime, using only what your "
                           "documents show.")]


def ais_income_gap(facts: Facts) -> list[Recommendation]:
    """Interest and dividends the tax department can see (AIS) vs what you've declared."""
    docs = facts.documents
    if docs is None or docs.draft is None or "ais" not in docs.categories:
        return []

    other = docs.draft.other_income
    reported = (
        other.savings_interest + other.deposit_interest + other.refund_interest + other.dividends.total
        + other.other_amount
    )
    declared = facts.declared.other_income_total if facts.declared else 0

    base = dict(
        id="doc_ais_income",
        category="tax_saving",
        level=3,
        basis="From your AIS",
        title="Make sure your AIS income is in your return",
        action_label="Check income in ITR Filing",
        action_href="/itr-filing",
        reason="The tax department already sees this income, and a mismatch with your return can lead to a notice.",
    )
    if declared is None:  # the tax comparison has one income total, no breakdown to check against
        if reported < MIN_INCOME_GAP:
            return []
        return [Recommendation(**base, description=(
            f"Your AIS reports {format_inr(reported)} of interest and dividend income. "
            "Check that it's included in the income you declare."))]

    gap = reported - declared
    if gap < MIN_INCOME_GAP:
        return []
    return [Recommendation(**base, description=(
        f"Your AIS reports {format_inr(reported)} of interest and dividend income, "
        f"but your ITR draft only has {format_inr(declared)}."))]


def form16_deductions(facts: Facts) -> list[Recommendation]:
    """Section 80C according to Form 16, and whether the ITR draft matches it."""
    docs = facts.documents
    if docs is None or docs.draft is None or "form16" not in docs.categories:
        return []

    on_form16 = sum(item.amount for item in docs.draft.deductions.section_80c)
    in_draft = facts.declared.section_80c_total if facts.declared and facts.declared.source == "itr_filing" else None
    cap = format_inr(SECTION_80C_CAP)

    base = dict(
        id="tax_80c",
        category="tax_saving",
        level=3,
        basis="From your Form 16",
        title="Check your Section 80C deductions",
        action_label="Review deductions",
        action_href="/itr-filing",
    )
    reason = "80C deductions only count if you choose the old regime."
    if facts.declared and facts.declared.regime and facts.declared.regime.better == "new":
        reason += " The new regime currently looks cheaper for you, so this matters less."

    if on_form16 == 0:
        return [Recommendation(**base, reason=reason, description=(
            "Your Form 16 shows no Section 80C deductions. Investments you made yourself, such as PPF or ELSS, "
            "can still be claimed when you file."))]
    if in_draft is not None and in_draft < on_form16:
        return [Recommendation(**base, reason=reason, description=(
            f"Your Form 16 shows {format_inr(on_form16)} under Section 80C, but your ITR draft has only "
            f"{format_inr(in_draft)}. Add the rest so you don't lose the deduction."))]

    headroom = max(0, SECTION_80C_CAP - max(on_form16, in_draft or 0))
    tail = f"leaving {format_inr(headroom)} of the {cap} limit unused" if headroom else "which uses your full limit"
    return [Recommendation(**base, reason=reason,
                           description=f"Your Form 16 shows {format_inr(on_form16)} under Section 80C, {tail}.")]


def hra_claim(facts: Facts) -> list[Recommendation]:
    """HRA is being paid but no rent is on record, so no exemption is being claimed."""
    docs = facts.documents
    if docs is None or docs.draft is None:
        return []

    hra = docs.draft.salary.hra
    rent = max(hra.rent_paid, facts.declared.rent_paid if facts.declared else 0)
    if hra.hra_received <= 0 or rent > 0:
        return []

    return [Recommendation(
        id="doc_hra_claim",
        category="tax_saving",
        level=3,
        basis=_basis(facts),
        title="Claim your HRA exemption",
        description=f"Your documents show about {format_inr(hra.hra_received)} of HRA a year, but no rent paid.",
        reason="If you pay rent, part of your HRA can be exempt from tax under the old regime, "
        "up to the HRA you receive.",
        action_label="Add rent details",
        action_href="/itr-filing",
    )]
