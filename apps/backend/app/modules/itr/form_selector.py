"""
Decides which ITR form a taxpayer must file, and which documents are still
needed for it, from the uploaded documents and the user's answers.

Rules (AY 2026-27, individuals):
- ITR-3: speculative (intraday) or F&O trading, or business/professional
  income that is not presumptive.
- ITR-2: capital gains other than LTCG u/s 112A up to Rs 1.25 lakh, total
  income above Rs 50 lakh, a company directorship, unlisted shares, foreign
  assets/income, agricultural income above Rs 5,000, more than two house
  properties, losses to carry forward, deferred ESOP tax, or non-residency.
- ITR-1: everything else (salary/pension, up to two house properties, other
  sources, LTCG 112A up to Rs 1.25 lakh).
MoneyMitra prepares ITR-1, ITR-2 (capital gains on listed shares and mutual
funds) and ITR-3 for share trading without books of account. Cases that
need schedules it doesn't build yet are reported as blockers.
"""

import re
from dataclasses import dataclass, field

from app.modules.itr.rules import ItrYearRules
from app.modules.itr.schemas import DocumentCheck, FormReason, FormRecommendation, ItrDraftData, RegimeComputation

SUPPORTED_FORMS = {"ITR-1", "ITR-2", "ITR-3"}
_LTCG_ITR1_LIMIT = 125_000
_FORM_ORDER = {"ITR-1": 1, "ITR-2": 2, "ITR-3": 3}


@dataclass
class DocumentFacts:
    """What the user's uploaded documents say, merged across documents."""

    categories: set[str] = field(default_factory=set)
    capital_gains: dict | None = None
    intraday: bool = False
    derivatives: bool = False
    tds_26as: list[dict] = field(default_factory=list)
    # From AIS / payslips / broker statement: last 4 of Aadhaar, masked mobile,
    # email, and last 4 digits of bank accounts seen.
    aadhaar_last4: str | None = None
    mobile_mask: str | None = None
    emails: set[str] = field(default_factory=set)
    bank_accounts: set[str] = field(default_factory=set)

    @classmethod
    def from_documents(cls, documents: list[tuple[str, dict | None]]) -> "DocumentFacts":
        """`documents` is (category, extracted JSON or None) per uploaded document."""
        facts = cls()
        for category, extracted in documents:
            facts.categories.add(category)
            f = (extracted or {}).get("facts", {})
            if f.get("capital_gains") and not (facts.capital_gains and not facts.capital_gains.get("detail_missing")):
                facts.capital_gains = f["capital_gains"]
            facts.intraday = facts.intraday or bool(f.get("intraday"))
            facts.derivatives = facts.derivatives or bool(f.get("derivatives"))
            if f.get("tds_26as"):
                facts.tds_26as = f["tds_26as"]
            identity = f.get("identity", {})
            facts.aadhaar_last4 = identity.get("aadhaar_last4", facts.aadhaar_last4)
            facts.mobile_mask = identity.get("mobile_mask", facts.mobile_mask)
            if identity.get("email"):
                facts.emails.add(identity["email"].lower())
            facts.bank_accounts.update(identity.get("bank_accounts", []))
        return facts


def _rs(amount: int) -> str:
    return f"Rs {amount:,}"


def recommend_form(
    draft: ItrDraftData, computation: RegimeComputation, facts: DocumentFacts, rules: ItrYearRules
) -> FormRecommendation:
    from app.modules.itr.computation import capital_gains  # local: computation imports schemas

    reasons: list[FormReason] = []
    blockers: list[str] = []

    def need(form: str, reason: str, source: str) -> None:
        reasons.append(FormReason(form=form, reason=reason, source=source))

    e = draft.eligibility
    t = draft.trading

    # ITR-3: share trading as business income
    if t.speculative_turnover or t.speculative_profit or facts.intraday:
        need("ITR-3", "Intraday share trades — this is speculative business income.",
             "AIS" if facts.intraday else "Your entries")
    if t.fno_turnover or t.fno_profit or facts.derivatives:
        need("ITR-3", "Futures & options (F&O) trades — this is business income.",
             "AIS" if facts.derivatives else "Your entries")
    if e.has_business_income:
        need("ITR-3", "You have business or professional income.", "Your answer")
        blockers.append("Business or professional income other than share trading isn't supported yet.")

    # ITR-2: capital gains and other ITR-1 exclusions
    if draft.capital_gains:
        cg = capital_gains(draft)
        source = "Your capital gains"
        if cg.gross_stcg_111a:
            need("ITR-2", f"Short-term capital gains on shares/equity funds ({_rs(cg.gross_stcg_111a)}).", source)
        if cg.gross_stcg_slab:
            need("ITR-2", f"Gains on debt mutual funds, taxed as short-term ({_rs(cg.gross_stcg_slab)}).", source)
        if cg.gross_ltcg_112a:
            need("ITR-2", f"Long-term capital gains on shares/equity funds ({_rs(cg.gross_ltcg_112a)}).", source)
    elif facts.capital_gains or e.has_capital_gains:
        need("ITR-2", "You have capital gains (sales of shares, mutual funds or property).",
             "AIS" if facts.capital_gains else "Your answer")
    if e.is_resident is False:
        need("ITR-2", "Non-residents can't use ITR-1.", "Your answer")
        blockers.append("Returns for non-residents aren't supported yet.")
    for flag, text in (
        ("is_director", "You were a company director during the year."),
        ("held_unlisted_shares", "You held unlisted equity shares."),
        ("has_foreign_assets_or_income", "You have foreign assets or foreign income."),
        ("agricultural_income_above_5000", "Agricultural income above Rs 5,000."),
        ("has_brought_forward_losses", "You have losses brought forward from earlier years."),
        ("tax_deferred_on_esop", "Tax deferred on start-up ESOPs."),
    ):
        if getattr(e, flag):
            need("ITR-2", text, "Your answer")
            blockers.append(f"{text} The schedule for this isn't supported yet.")
    if computation.total_income > rules.itr1_total_income_limit:
        need("ITR-2", "Total income is above Rs 50 lakh.", "Calculated")
        blockers.append("Income above Rs 50 lakh needs the assets & liabilities schedule, which isn't supported yet.")
    if len(draft.house_properties) > rules.max_house_properties:
        need("ITR-2", "More than two house properties.", "Your entries")

    form = max((r.form for r in reasons), key=lambda f: _FORM_ORDER[f], default="ITR-1")
    if form != "ITR-1":
        if draft.house_properties:
            blockers.append(f"House property in {form} isn't supported yet.")
        if draft.regime == "old":
            blockers.append(f"The old tax regime in {form} isn't supported yet — choose the new regime.")

    return FormRecommendation(
        form=form,
        supported=form in SUPPORTED_FORMS and not blockers,
        blockers=list(dict.fromkeys(blockers)),
        reasons=[r for r in reasons if r.form == form] or [
            FormReason(form="ITR-1", reason="Salary, interest and other income that ITR-1 covers.", source="Calculated")
        ],
        other_reasons=[r for r in reasons if r.form != form],
        checklist=_checklist(draft, computation, facts, form),
    )


def _checklist(
    draft: ItrDraftData, computation: RegimeComputation, facts: DocumentFacts, form: str
) -> list[DocumentCheck]:
    have = facts.categories
    items: list[DocumentCheck] = []

    def add(category: str, title: str, why: str, required: bool = True) -> None:
        items.append(DocumentCheck(category=category, title=title, why=why, required=required,
                                   uploaded=category in have))

    add("pan", "PAN card", "Your name, father's name and date of birth exactly as on PAN.")
    add("ais", "AIS (Annual Information Statement)", "All income and transactions the department already knows about.")
    add("form26as", "Form 26AS", "Tax already deducted (TDS/TCS) — to check every TDS claim matches.")
    if computation.gross_salary > 0 or "form16" in have or draft.salary.employers:
        add("form16", "Form 16 (Part A and Part B)", "Salary, exemptions and TDS from your employer.")
        add("payslips", "Payslip for March", "Confirms full-year salary and HRA figures.", required=False)
    if facts.capital_gains or draft.eligibility.has_capital_gains or draft.capital_gains:
        add("capital_gains", "Capital gains statement (broker P&L and mutual fund CAS)",
            "Buy dates and cost of each sale — needed to compute capital gains correctly.")
    if facts.intraday or facts.derivatives or draft.trading.speculative_turnover or draft.trading.fno_turnover:
        add("capital_gains", "Broker tax P&L for intraday / F&O", "Turnover and profit/loss for business income in ITR-3.")
    if any(p.interest_on_loan > 0 for p in draft.house_properties):
        add("home_loan", "Home-loan interest certificate", "Interest paid on the loan for house property.")
    if draft.regime == "old":
        add("tax_proofs", "Tax-saving proofs (80C, 80D, NPS)", "Only needed for deductions under the old regime.",
            required=False)

    # One entry per category (the capital-gains statement can be listed twice).
    seen: set[str] = set()
    unique = []
    for item in items:
        if item.category in seen:
            continue
        seen.add(item.category)
        unique.append(item)
    return unique


def tds_cross_check(draft: ItrDraftData, facts: DocumentFacts) -> list[str]:
    """Compares the TDS claimed in the return with Form 26AS."""
    if not facts.tds_26as:
        return []
    in_26as = {e["tan"]: e for e in facts.tds_26as}
    claimed: dict[str, tuple[str, int]] = {}
    for emp in draft.salary.employers:
        if emp.tan:
            claimed[emp.tan.upper()] = (emp.name or emp.tan, claimed.get(emp.tan.upper(), ("", 0))[1] + emp.tds)
    for t in draft.taxes_paid.tds_other:
        if t.tan:
            claimed[t.tan.upper()] = (t.deductor_name or t.tan, claimed.get(t.tan.upper(), ("", 0))[1] + t.tds_claimed)

    warnings = []
    for tan, (name, amount) in claimed.items():
        entry = in_26as.get(tan)
        if entry is None:
            if amount > 0:
                warnings.append(
                    f"TDS of {_rs(amount)} claimed from {name} ({tan}) is not in your Form 26AS — "
                    "the department won't give credit for it. Remove it or check the TAN."
                )
            else:
                warnings.append(f"{name} ({tan}) is not in your Form 26AS — remove this entry if it isn't yours.")
        elif amount > entry["tds"]:
            warnings.append(
                f"TDS claimed from {name} ({_rs(amount)}) is more than Form 26AS shows ({_rs(entry['tds'])})."
            )
    for tan, entry in in_26as.items():
        if tan not in claimed:
            warnings.append(
                f"Form 26AS shows TDS of {_rs(entry['tds'])} from {entry['name']} ({tan}) that isn't claimed in "
                "your return — add it so you get credit."
            )
    return warnings


def identity_checks(draft: ItrDraftData, facts: DocumentFacts) -> list[str]:
    """Compares contact and bank details in the return with the taxpayer's documents."""
    p = draft.personal
    warnings = []
    for label, value in (("Father's name", p.father_name), ("First name", p.first_name), ("Last name", p.last_name)):
        words = re.findall(r"[A-Za-z]+", value or "")
        if value and (not words or any(len(w) > 2 and not re.search(r"[aeiouyAEIOUY]", w) for w in words)):
            warnings.append(f"{label} '{value.strip()}' doesn't look like a real name — enter it exactly as on the PAN card.")
    if facts.aadhaar_last4 and p.aadhaar and not p.aadhaar.strip().endswith(facts.aadhaar_last4):
        warnings.append(
            f"Aadhaar ends in {p.aadhaar.strip()[-4:]}, but your AIS shows one ending {facts.aadhaar_last4}."
        )
    mobile = (p.mobile or "").strip()
    if facts.mobile_mask and len(mobile) == 10 and any(
        m != "X" and m != d for m, d in zip(facts.mobile_mask, mobile)
    ):
        warnings.append(
            f"Mobile {mobile} doesn't match the number on your AIS ({facts.mobile_mask}). The department sends "
            "refund and e-verification messages to this number."
        )
    if facts.emails and p.email and p.email.strip().lower() not in facts.emails:
        warnings.append(
            f"Email {p.email.strip()} differs from the one on your documents ({', '.join(sorted(facts.emails))})."
        )
    for b in draft.bank_accounts:
        ifsc = (b.ifsc or "").upper()
        if ifsc.startswith("TEST") or "test" in (b.bank_name or "").lower():
            warnings.append(f"Bank account {b.bank_name or ifsc} looks like test data — use your real account.")
    refund = next((b for b in draft.bank_accounts if b.use_for_refund), None)
    if refund and facts.bank_accounts and refund.account_no and refund.account_no.strip()[-4:] not in facts.bank_accounts:
        endings = ", ".join(sorted(facts.bank_accounts))
        warnings.append(
            f"The refund account (ending {refund.account_no.strip()[-4:]}) isn't one that appears in your documents "
            f"(account ending {endings}). Make sure it is yours and pre-validated on the Income Tax portal."
        )
    return warnings
