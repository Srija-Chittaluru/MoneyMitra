"""
Finance overview: one read-only view of the user's money, built from what
the other modules already know. No tax rules live here — income and tax come
from the ITR computation (or the saved tax comparison), deduction headroom from
the tax plan, next steps from recommendations and dates from resources.
"""

from collections import Counter
from datetime import date

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.documents.service import list_documents
from app.modules.extraction.guardrails import DOCUMENT_NAMES
from app.modules.finance.schemas import (
    ActionOut,
    AlertOut,
    AmountLine,
    DocumentCountOut,
    DocumentsOut,
    FilingOut,
    FinanceOverview,
    IncomeOut,
    InvestmentsOut,
    MissingDocumentOut,
    TaxOut,
    TaxSavingOut,
)
from app.modules.itr import service as itr_service
from app.modules.itr.models import ItrFiling
from app.modules.itr.rules import get_itr_rules
from app.modules.itr.schemas import ItrDraftData, ItrSummary
from app.modules.planning.service import get_tax_plan
from app.modules.recommendations.context import FinancialContext, load_latest_financial_context
from app.modules.recommendations.service import get_recommendations
from app.modules.resources.service import get_resources
from app.modules.users.models import User

MAX_ACTIONS = 3
# Recommendations restating the tax and refund this page already shows (from a
# documents-only estimate that can differ from the user's edited ITR draft).
_DUPLICATE_ACTIONS = {"doc_tds_vs_tax", "tax_regime_choice"}
MAX_ALERTS = 3

# Documents most people need, shown as missing when there is no ITR draft to
# say exactly which ones this user needs.
_BASIC_DOCUMENTS = [
    ("pan", "PAN card", "Confirms whose return this is."),
    ("form16", "Form 16", "Your salary and the tax your employer deducted."),
    ("ais", "AIS", "Interest, dividends and trades the tax department already knows about."),
]


def _latest_itr(db: Session, user: User) -> tuple[ItrFiling, ItrDraftData] | None:
    filing = db.scalar(
        select(ItrFiling).where(ItrFiling.user_id == user.id).order_by(ItrFiling.assessment_year.desc()).limit(1)
    )
    if filing is None:
        return None
    try:
        return filing, ItrDraftData.model_validate(filing.data)
    except ValidationError:
        return None


def _itr_summary(db: Session, user: User, today: date) -> tuple[ItrDraftData, ItrSummary] | None:
    latest = _latest_itr(db, user)
    if latest is None:
        return None
    filing, draft = latest
    rules = get_itr_rules(filing.assessment_year)
    if rules is None:
        return None
    summary = itr_service.build_summary(draft, rules, today, itr_service.document_facts(db, user))
    if summary.selected.gross_total_income <= 0:
        return None
    return draft, summary


def _income_from_itr(draft: ItrDraftData, summary: ItrSummary) -> IncomeOut:
    s = summary.selected
    candidates = [
        ("salary", "Salary", s.gross_salary),
        ("salary_deductions", "Standard deduction & exemptions", s.income_from_salary - s.gross_salary),
        ("house_property", "House property", s.income_from_house_property),
        ("other_sources", "Interest & dividends", s.income_from_other_sources),
        ("capital_gains", "Capital gains", s.income_from_capital_gains),
        ("business", "Trading (F&O / intraday)", s.income_from_business),
    ]
    lines = [AmountLine(key=k, label=label, amount=amount) for k, label, amount in candidates if amount]
    take_home = None
    if s.gross_salary > 0:
        salary_tds = sum(employer.tds for employer in draft.salary.employers)
        take_home = max(0, s.gross_salary - s.professional_tax - salary_tds) // 12
    return IncomeOut(total=s.gross_total_income, lines=lines, monthly_take_home=take_home)


def _tax_from_itr(summary: ItrSummary) -> TaxOut:
    s, other = summary.selected, summary.alternative
    return TaxOut(
        regime=s.regime,
        tax=s.gross_tax_liability,
        effective_rate=round(100 * s.gross_tax_liability / s.total_income, 1) if s.total_income else 0.0,
        other_regime_tax=other.gross_tax_liability if other else None,
        savings=max(0, other.gross_tax_liability - s.gross_tax_liability) if other else None,
        taxes_paid=s.total_taxes_paid,
        refund_due=s.refund_due,
        balance_payable=s.balance_payable,
    )


def _filing(summary: ItrSummary, today: date) -> FilingOut | None:
    form = summary.recommended_form
    if form is None:
        return None
    rules = itr_service.rules_for_form(get_itr_rules(summary.assessment_year), form.form)
    return FilingOut(
        assessment_year=summary.assessment_year,
        form=form.form,
        supported=form.supported,
        due_date=rules.due_date,
        is_belated=summary.is_belated,
        days_to_due=(rules.due_date - today).days,
        ready_to_file=summary.can_export,
        open_items=len(summary.missing_fields) + len(summary.eligibility_issues),
    )


def _investments(draft: ItrDraftData, summary: ItrSummary) -> InvestmentsOut | None:
    trading = draft.trading
    has_trading = trading.speculative_turnover or trading.fno_turnover
    if not draft.capital_gains and not has_trading:
        return None
    s = summary.selected
    gains = [
        AmountLine(key="stcg_111a", label="Short-term, listed equity (20%)", amount=s.stcg_111a),
        AmountLine(key="ltcg_112a", label="Long-term, listed equity (12.5% above ₹1.25L)", amount=s.ltcg_112a),
        AmountLine(key="stcg_slab", label="Debt funds & others (slab rate)", amount=s.stcg_slab),
    ]
    trading_lines = []
    if trading.speculative_turnover:
        trading_lines.append(AmountLine(key="intraday", label="Intraday", amount=trading.speculative_profit))
    if trading.fno_turnover:
        trading_lines.append(AmountLine(key="fno", label="F&O, after expenses",
                                        amount=trading.fno_profit - trading.fno_expenses))
    return InvestmentsOut(
        trades=len(draft.capital_gains),
        sale_value=sum(txn.sale_value for txn in draft.capital_gains),
        gains=[g for g in gains if g.amount],
        total_gain=s.income_from_capital_gains,
        trading=trading_lines,
    )


def _from_comparison(context: FinancialContext) -> tuple[IncomeOut, TaxOut | None]:
    income = IncomeOut(
        total=context.annual_income,
        lines=[AmountLine(key="gross", label="Gross total income", amount=context.annual_income)],
        monthly_take_home=None,
    )
    regime = context.regime
    if regime is None:
        return income, None
    chosen = "old" if regime.better == "old" else "new"
    tax = regime.old_tax if chosen == "old" else regime.new_tax
    return income, TaxOut(
        regime=chosen,
        tax=tax,
        effective_rate=round(100 * tax / context.annual_income, 1),
        other_regime_tax=regime.new_tax if chosen == "old" else regime.old_tax,
        savings=regime.difference,
        taxes_paid=None,
        refund_due=None,
        balance_payable=None,
    )


def _documents(db: Session, user: User, summary: ItrSummary | None) -> DocumentsOut:
    documents = list_documents(db, user)
    counts = Counter(d.category for d in documents)
    by_category = [
        DocumentCountOut(category=category, label=DOCUMENT_NAMES.get(category, category), count=count)
        for category, count in sorted(counts.items(), key=lambda item: -item[1])
    ]
    if summary and summary.recommended_form:
        missing = [
            MissingDocumentOut(category=c.category, title=c.title, why=c.why)
            for c in summary.recommended_form.checklist
            if c.required and not c.uploaded
        ]
    else:
        missing = [
            MissingDocumentOut(category=category, title=title, why=why)
            for category, title, why in _BASIC_DOCUMENTS
            if category not in counts
        ]
    return DocumentsOut(uploaded=len(documents), by_category=by_category, missing=missing)


def _tax_saving_note(tax: TaxOut | None, fy_label: str) -> str:
    note = "These deductions only lower your tax under the old regime."
    if tax and tax.regime == "new" and tax.other_regime_tax is None:
        note += (f" Your return can only use the new regime now, so they won't change it — plan them for "
                 f"FY {fy_label} if the old regime suits you then.")
    return note


def get_overview(db: Session, user: User, today: date | None = None) -> FinanceOverview:
    today = today or date.today()
    latest = load_latest_financial_context(db, user, today)
    updated_at, context = latest if latest else (None, None)

    itr = _itr_summary(db, user, today) if context and context.source == "itr_filing" else None
    income = tax = filing = investments = None
    if itr:
        draft, summary = itr
        income, tax = _income_from_itr(draft, summary), _tax_from_itr(summary)
        filing, investments = _filing(summary, today), _investments(draft, summary)
    elif context:
        income, tax = _from_comparison(context)

    plan = get_tax_plan(db, user, today)
    tax_saving = [
        TaxSavingOut(section=s.section, label=s.label, cap=s.cap, declared=s.declared_amount, headroom=s.headroom)
        for s in plan.sections
    ] if plan.has_data else []

    recommendations = [
        r for r in get_recommendations(db, user, today=today).recommendations
        if not (tax and r.id in _DUPLICATE_ACTIONS)
    ][:MAX_ACTIONS]
    alerts = get_resources(today).alerts[:MAX_ALERTS]

    return FinanceOverview(
        source=context.source if context else None,
        financial_year=context.financial_year if context else None,
        updated_at=updated_at,
        income=income,
        tax=tax,
        filing=filing,
        investments=investments,
        tax_saving=tax_saving,
        tax_saving_year=plan.fy_label,
        tax_saving_note=_tax_saving_note(tax, plan.fy_label),
        documents=_documents(db, user, itr[1] if itr else None),
        actions=[
            ActionOut(title=r.title, description=r.description, action_label=r.action_label,
                      action_href=r.action_href)
            for r in recommendations
        ],
        alerts=[AlertOut(title=a.title, date=a.date, category=a.category) for a in alerts],
    )
