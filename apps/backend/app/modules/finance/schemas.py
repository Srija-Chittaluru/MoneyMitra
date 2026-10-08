from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel


class AmountLine(BaseModel):
    key: str
    label: str
    amount: int


class IncomeOut(BaseModel):
    total: int
    lines: list[AmountLine]
    # Salary after professional tax and the TDS your employer deducted, per
    # month; None when there is no salary breakdown (a tax comparison).
    monthly_take_home: int | None


class TaxOut(BaseModel):
    regime: Literal["old", "new"]
    tax: int  # tax and cess, before interest and late fee
    effective_rate: float  # percent of total income
    # The other regime's tax, when both can still be chosen.
    other_regime_tax: int | None
    savings: int | None
    # Only from an ITR draft, which knows the TDS and advance tax paid.
    taxes_paid: int | None
    refund_due: int | None
    balance_payable: int | None


class FilingOut(BaseModel):
    assessment_year: str
    form: str
    supported: bool
    due_date: date
    is_belated: bool
    days_to_due: int  # negative once the due date has passed
    ready_to_file: bool
    open_items: int


class InvestmentsOut(BaseModel):
    trades: int
    sale_value: int
    gains: list[AmountLine]  # realised capital gains by tax treatment
    total_gain: int
    trading: list[AmountLine]  # intraday and F&O profit after expenses


class TaxSavingOut(BaseModel):
    section: str
    label: str
    cap: int
    declared: int
    headroom: int


class DocumentCountOut(BaseModel):
    category: str
    label: str
    count: int


class MissingDocumentOut(BaseModel):
    category: str
    title: str
    why: str


class DocumentsOut(BaseModel):
    uploaded: int
    by_category: list[DocumentCountOut]
    missing: list[MissingDocumentOut]


class ActionOut(BaseModel):
    title: str
    description: str
    action_label: str | None
    action_href: str | None


class AlertOut(BaseModel):
    title: str
    date: date
    category: str


class FinanceOverview(BaseModel):
    """Everything MoneyMitra knows about the user's money, gathered from their
    documents, ITR draft, tax comparison, tax plan and recommendations.

    A section is null (or empty) until the data it is calculated from exists;
    nothing is assumed or made up.
    """

    source: Literal["itr_filing", "tax_comparison"] | None
    financial_year: str | None
    updated_at: datetime | None
    income: IncomeOut | None
    tax: TaxOut | None
    filing: FilingOut | None
    investments: InvestmentsOut | None
    # This year's room left under each deduction; it only lowers tax under the old regime.
    tax_saving: list[TaxSavingOut]
    tax_saving_year: str
    tax_saving_note: str
    documents: DocumentsOut
    actions: list[ActionOut]
    alerts: list[AlertOut]
