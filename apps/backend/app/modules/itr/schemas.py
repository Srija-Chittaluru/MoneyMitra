"""
Draft ITR-1 data as entered by the user, plus API response shapes.

Every draft field is optional so a partially filled form can be saved step
by step. Format checks (PAN, IFSC, TAN, ...) are deliberately NOT enforced
here — they run in `validation.py` and are reported as missing/invalid
fields on the review screen, so saving never blocks on an unfinished step.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Amount = int
# Rs 1,000 crore — far above any individual return; stops typos and abuse.
MAX_AMOUNT = 10_000_000_000


class _Draft(BaseModel):
    model_config = ConfigDict(extra="ignore")


# ---------------------------------------------------------------------------
# Personal info
# ---------------------------------------------------------------------------

EmployerCategory = Literal["CGOV", "SGOV", "PSU", "PE", "PESG", "PEPS", "PEO", "OTH", "NA"]


class AddressDraft(_Draft):
    flat_no: str | None = Field(default=None, max_length=50)
    building: str | None = Field(default=None, max_length=50)
    street: str | None = Field(default=None, max_length=50)
    locality: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=50)
    state_code: str | None = None
    pin_code: str | None = None


class PersonalDraft(_Draft):
    first_name: str | None = Field(default=None, max_length=25)
    middle_name: str | None = Field(default=None, max_length=25)
    last_name: str | None = Field(default=None, max_length=75)
    father_name: str | None = Field(default=None, max_length=125)
    pan: str | None = None
    aadhaar: str | None = None
    date_of_birth: date | None = None
    mobile: str | None = None
    email: str | None = Field(default=None, max_length=125)
    employer_category: EmployerCategory | None = None
    address: AddressDraft = Field(default_factory=AddressDraft)


class EligibilityDraft(_Draft):
    """Answers to the ITR-1 eligibility questions. Any `True` (or a `False`
    for `is_resident`) means the user must file a different ITR form."""

    is_resident: bool | None = None
    is_director: bool = False
    held_unlisted_shares: bool = False
    has_foreign_assets_or_income: bool = False
    has_capital_gains: bool = False
    has_business_income: bool = False
    agricultural_income_above_5000: bool = False
    has_brought_forward_losses: bool = False
    tax_deferred_on_esop: bool = False


# ---------------------------------------------------------------------------
# Income
# ---------------------------------------------------------------------------


class EmployerDraft(_Draft):
    name: str | None = Field(default=None, max_length=125)
    tan: str | None = None
    # Employer address — required in ITR-2 / ITR-3 Schedule S.
    address: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=50)
    state_code: str | None = None
    pin_code: str | None = None
    income_chargeable: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    tds: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class HraDraft(_Draft):
    """Inputs for the section 10(13A) HRA exemption (old regime only)."""

    basic_salary: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    dearness_allowance: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    hra_received: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    rent_paid: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    is_metro: bool = False


class SalaryDraft(_Draft):
    salary_17_1: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    perquisites_17_2: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    profits_17_3: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    hra: HraDraft = Field(default_factory=HraDraft)
    lta_exemption: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    gratuity_exemption: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    leave_encashment_exemption: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    professional_tax: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    employers: list[EmployerDraft] = Field(default_factory=list, max_length=10)


class HomeLoanDraft(_Draft):
    lender_type: Literal["B", "I"] = "B"
    lender_name: str | None = Field(default=None, max_length=125)
    account_no: str | None = Field(default=None, max_length=20)
    sanction_date: date | None = None
    total_amount: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    outstanding_amount: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class HousePropertyDraft(_Draft):
    property_type: Literal["self_occupied", "let_out", "deemed_let_out"] = "self_occupied"
    address: str | None = Field(default=None, max_length=50)
    city: str | None = Field(default=None, max_length=50)
    state_code: str | None = None
    pin_code: str | None = None
    gross_rent: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    municipal_tax_paid: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    interest_on_loan: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    loan: HomeLoanDraft = Field(default_factory=HomeLoanDraft)
    tenant_name: str | None = Field(default=None, max_length=125)


class DividendDraft(_Draft):
    """Quarterly breakup required by the schema (used for 234C)."""

    upto_15_jun: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    jun_16_to_sep_15: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    sep_16_to_dec_15: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    dec_16_to_mar_15: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    mar_16_to_mar_31: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)

    @property
    def total(self) -> int:
        return (
            self.upto_15_jun
            + self.jun_16_to_sep_15
            + self.sep_16_to_dec_15
            + self.dec_16_to_mar_15
            + self.mar_16_to_mar_31
        )


class OtherIncomeDraft(_Draft):
    savings_interest: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    deposit_interest: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    refund_interest: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    family_pension: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    dividends: DividendDraft = Field(default_factory=DividendDraft)
    other_amount: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    other_description: str | None = Field(default=None, max_length=125)


# ---------------------------------------------------------------------------
# Deductions (Chapter VI-A)
# ---------------------------------------------------------------------------


class Section80CItem(_Draft):
    description: str | None = Field(default=None, max_length=50)
    identification_no: str | None = Field(default=None, max_length=50)
    amount: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class HealthPolicyDraft(_Draft):
    insurer: str | None = Field(default=None, max_length=125)
    policy_no: str | None = Field(default=None, max_length=75)
    premium: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class Health80DDraft(_Draft):
    """One 80D bucket: either self/family, or parents."""

    claiming: bool = False
    includes_senior_citizen: bool = False
    policies: list[HealthPolicyDraft] = Field(default_factory=list, max_length=10)
    preventive_checkup: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    # Only allowed when the bucket includes a senior citizen with no insurance.
    medical_expenditure: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class DeductionsDraft(_Draft):
    section_80c: list[Section80CItem] = Field(default_factory=list, max_length=20)
    section_80ccd_1b: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    section_80ccd_2: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    pran: str | None = None
    health_self: Health80DDraft = Field(default_factory=Health80DDraft)
    health_parents: Health80DDraft = Field(default_factory=Health80DDraft)


# ---------------------------------------------------------------------------
# Taxes paid, bank, verification
# ---------------------------------------------------------------------------


class TdsOtherDraft(_Draft):
    deductor_name: str | None = Field(default=None, max_length=125)
    tan: str | None = None
    section: str = "94A"
    amount_paid: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    tds_deducted: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    tds_claimed: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    deducted_year: str = "2025"


class TcsDraft(_Draft):
    collector_name: str | None = Field(default=None, max_length=125)
    tan: str | None = None
    amount_collected: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    amount_claimed: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class ChallanDraft(_Draft):
    bsr_code: str | None = None
    date_of_deposit: date | None = None
    challan_serial_no: str | None = None
    amount: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class TaxesPaidDraft(_Draft):
    tds_other: list[TdsOtherDraft] = Field(default_factory=list, max_length=20)
    tcs: list[TcsDraft] = Field(default_factory=list, max_length=20)
    challans: list[ChallanDraft] = Field(default_factory=list, max_length=20)


class BankAccountDraft(_Draft):
    ifsc: str | None = None
    bank_name: str | None = Field(default=None, max_length=125)
    account_no: str | None = Field(default=None, max_length=20)
    account_type: Literal["SB", "CA", "CC", "OD", "NRO", "OTH"] = "SB"
    use_for_refund: bool = False


# ---------------------------------------------------------------------------
# Capital gains and trading (ITR-2 / ITR-3)
# ---------------------------------------------------------------------------


class CapitalGainTxn(_Draft):
    """One sale of shares or mutual fund units.

    equity_share / equity_mf: STT-paid listed equity — short term u/s 111A
    (20%) or long term u/s 112A (12.5% above Rs 1.25 lakh).
    debt_mf: specified mutual fund u/s 50AA — always short term, slab rate."""

    asset_type: Literal["equity_share", "equity_mf", "debt_mf"] = "equity_share"
    term: Literal["short", "long"] = "short"
    name: str | None = Field(default=None, max_length=125)
    isin: str | None = None
    quantity: float = Field(default=0, ge=0, le=MAX_AMOUNT)
    purchase_date: date | None = None
    sale_date: date | None = None
    sale_value: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    cost: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    expenses: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    # Grandfathering for long-term equity bought on or before 31 Jan 2018.
    acquired_before_feb_2018: bool = False
    fmv_31_jan_2018: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class TradingDraft(_Draft):
    """Share trading reported as business income (ITR-3, no books of account).

    Intraday trades are speculative business; F&O is non-speculative business.
    Profit can be negative (a loss)."""

    speculative_turnover: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    speculative_profit: int = Field(default=0, ge=-MAX_AMOUNT, le=MAX_AMOUNT)
    fno_turnover: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)
    fno_profit: int = Field(default=0, ge=-MAX_AMOUNT, le=MAX_AMOUNT)
    fno_expenses: Amount = Field(default=0, ge=0, le=MAX_AMOUNT)


class ItrDraftData(_Draft):
    regime: Literal["new", "old"] = "new"
    personal: PersonalDraft = Field(default_factory=PersonalDraft)
    eligibility: EligibilityDraft = Field(default_factory=EligibilityDraft)
    salary: SalaryDraft = Field(default_factory=SalaryDraft)
    house_properties: list[HousePropertyDraft] = Field(default_factory=list, max_length=2)
    other_income: OtherIncomeDraft = Field(default_factory=OtherIncomeDraft)
    deductions: DeductionsDraft = Field(default_factory=DeductionsDraft)
    taxes_paid: TaxesPaidDraft = Field(default_factory=TaxesPaidDraft)
    capital_gains: list[CapitalGainTxn] = Field(default_factory=list, max_length=500)
    trading: TradingDraft = Field(default_factory=TradingDraft)
    bank_accounts: list[BankAccountDraft] = Field(default_factory=list, max_length=5)
    verification_place: str | None = Field(default=None, max_length=50)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class AssessmentYearInfo(BaseModel):
    assessment_year: str
    financial_year: str
    due_date: date
    belated_deadline: date


class ItrFilingOut(BaseModel):
    assessment_year: str
    status: Literal["draft", "exported"]
    data: ItrDraftData
    updated_at: datetime
    last_exported_at: datetime | None
    # Draft path -> document it was auto-filled from, e.g. {"personal.pan": "Form 16"}
    field_sources: dict[str, str] = {}


class Issue(BaseModel):
    """`field` is a dotted path into the draft (e.g. `personal.pan`) so the
    UI can send the user to the right step; `None` for form-level issues."""

    field: str | None
    message: str


class RegimeComputation(BaseModel):
    regime: Literal["new", "old"]
    gross_salary: int
    exempt_allowances: int
    net_salary: int
    standard_deduction: int
    professional_tax: int
    income_from_salary: int
    income_from_house_property: int
    income_from_other_sources: int
    family_pension_deduction: int
    # Capital gains after set-off of capital losses within the head.
    stcg_111a: int = 0
    stcg_slab: int = 0  # debt funds u/s 50AA and other short-term gains at slab rates
    ltcg_112a: int = 0
    income_from_capital_gains: int = 0
    # Business income (ITR-3): intraday (speculative) and F&O (non-speculative).
    speculative_income: int = 0
    business_income: int = 0
    income_from_business: int = 0
    losses_carried_forward: dict[str, int] = {}
    gross_total_income: int
    chapter_via_deductions: int
    deduction_breakup: dict[str, int]
    total_income: int
    tax_on_total_income: int
    tax_at_normal_rates: int = 0
    tax_at_special_rates: int = 0
    rebate_87a: int
    tax_after_rebate: int
    surcharge: int
    cess: int
    gross_tax_liability: int
    interest_234a: int
    interest_234b: int
    interest_234c: int
    fee_234f: int
    total_tax_and_interest: int
    tds: int
    tcs: int
    advance_tax: int
    self_assessment_tax: int
    total_taxes_paid: int
    refund_due: int
    balance_payable: int


class FormReason(BaseModel):
    form: Literal["ITR-1", "ITR-2", "ITR-3"]
    reason: str
    source: str  # "AIS", "Your answer", "Calculated", ...


class DocumentCheck(BaseModel):
    category: str  # Documents category to upload it under
    title: str
    why: str
    required: bool
    uploaded: bool


class FormRecommendation(BaseModel):
    form: Literal["ITR-1", "ITR-2", "ITR-3"]
    supported: bool  # whether MoneyMitra can prepare this form today
    blockers: list[str] = []  # why it can't, when not supported
    reasons: list[FormReason]
    other_reasons: list[FormReason]  # triggers for simpler forms, for context
    checklist: list[DocumentCheck]


class ItrSummary(BaseModel):
    assessment_year: str
    filing_date: date
    filing_section: Literal["139(1)", "139(4)"]
    is_belated: bool
    old_regime_allowed: bool
    selected: RegimeComputation
    alternative: RegimeComputation | None
    eligibility_issues: list[Issue]
    missing_fields: list[Issue]
    warnings: list[str]
    can_export: bool
    recommended_form: FormRecommendation | None = None


class ItrExport(BaseModel):
    file_name: str
    form: str = "ITR-1"
    itr: dict
