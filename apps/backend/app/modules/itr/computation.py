"""
ITR-1 computation of income, deductions, tax, interest and refund.

Pure functions over the draft — no database access — so the same numbers
feed the review screen and the exported JSON. Slab tax, the 87A rebate and
surcharge reuse the tax module's calculator; everything ITR-specific
(heads of income, Chapter VI-A caps, interest) lives here.

All amounts are whole rupees. Intermediate values are rounded half-up to the
rupee, and total income is rounded to the nearest Rs 10 (section 288A), so
every derived figure in the JSON is an exact sum of its parts — the e-filing
validation rules check those identities.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from app.modules.itr import interest
from app.modules.itr.rules import ItrYearRules
from app.modules.itr.schemas import Health80DDraft, ItrDraftData, RegimeComputation
from app.modules.tax.age import resolve_age_category
from app.modules.tax.calculator import apply_rebate, calculate_slab_tax, calculate_surcharge
from app.modules.tax.money import round_to_nearest_10
from app.modules.tax.rules.types import AgeCategory

Regime = Literal["new", "old"]

ZERO = Decimal("0")
_GOVT_EMPLOYERS = {"CGOV", "SGOV"}


def rupees(amount: Decimal) -> Decimal:
    return amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class HraComputation:
    salary_for_hra: int  # basic + DA
    hra_received: int
    rent_paid: int
    rent_minus_10_percent: int
    percent_of_salary: int  # 40% / 50% of basic + DA
    exemption: int


@dataclass(frozen=True)
class PropertyComputation:
    index: int
    property_type: str
    annual_value: int  # gross rent (0 for self-occupied)
    local_taxes: int
    balance: int  # annual value - local taxes
    standard_deduction: int  # 30% of balance
    interest_allowed: int
    income: int  # may be negative


@dataclass(frozen=True)
class HealthComputation:
    insurance: int
    preventive: int
    medical: int
    deduction: int


@dataclass
class ItrComputation:
    regime: Regime
    age_category: AgeCategory
    filing_date: date
    hra: HraComputation | None
    properties: list[PropertyComputation]
    house_property_total: int  # sum of property incomes, before set-off limits
    health_self: HealthComputation
    health_parents: HealthComputation
    deductions: dict[str, int]
    advance_tax_payments: list[interest.Payment]
    self_assessment_payments: list[interest.Payment]
    summary: RegimeComputation
    notes: list[str] = field(default_factory=list)


def _hra(draft: ItrDraftData) -> HraComputation:
    h = draft.salary.hra
    salary = Decimal(h.basic_salary + h.dearness_allowance)
    rent_minus = max(ZERO, Decimal(h.rent_paid) - salary * Decimal("0.10"))
    pct = salary * (Decimal("0.50") if h.is_metro else Decimal("0.40"))
    exemption = min(Decimal(h.hra_received), rent_minus, pct) if h.rent_paid > 0 else ZERO
    # Validation rule 176: HRA exemption cannot exceed 1/3rd of salary u/s 17(1).
    exemption = min(exemption, Decimal(draft.salary.salary_17_1) / 3)
    return HraComputation(
        salary_for_hra=int(salary),
        hra_received=h.hra_received,
        rent_paid=h.rent_paid,
        rent_minus_10_percent=int(rupees(rent_minus)),
        percent_of_salary=int(rupees(pct)),
        exemption=int(rupees(max(ZERO, exemption))),
    )


def _house_properties(draft: ItrDraftData, regime: Regime, rules: ItrYearRules) -> list[PropertyComputation]:
    results: list[PropertyComputation] = []
    remaining_sop_cap = rules.self_occupied_interest_cap
    for index, prop in enumerate(draft.house_properties, start=1):
        if prop.property_type == "self_occupied":
            if regime == "old":
                allowed = min(Decimal(prop.interest_on_loan), remaining_sop_cap)
                remaining_sop_cap -= allowed
            else:
                allowed = ZERO  # rule 162: no interest on self-occupied property in the new regime
            results.append(
                PropertyComputation(index, prop.property_type, 0, 0, 0, 0, int(allowed), -int(allowed))
            )
            continue

        annual_value = Decimal(prop.gross_rent)
        local_taxes = min(Decimal(prop.municipal_tax_paid), annual_value)
        balance = annual_value - local_taxes
        thirty = rupees(balance * rules.house_property_standard_deduction_rate)
        allowed = Decimal(prop.interest_on_loan)
        results.append(
            PropertyComputation(
                index,
                prop.property_type,
                int(annual_value),
                int(local_taxes),
                int(balance),
                int(thirty),
                int(allowed),
                int(balance - thirty - allowed),
            )
        )
    return results


def _health(bucket: Health80DDraft, cap: Decimal, preventive_left: Decimal) -> tuple[HealthComputation, Decimal]:
    if not bucket.claiming:
        return HealthComputation(0, 0, 0, 0), preventive_left
    insurance = Decimal(sum(p.premium for p in bucket.policies))
    preventive = min(Decimal(bucket.preventive_checkup), preventive_left)
    # Medical expenditure is only deductible for a senior citizen with no health insurance.
    medical = Decimal(bucket.medical_expenditure) if bucket.includes_senior_citizen and insurance == 0 else ZERO
    deduction = min(insurance + preventive + medical, cap)
    return (
        HealthComputation(int(insurance), int(preventive), int(medical), int(deduction)),
        preventive_left - preventive,
    )


def _restrict_to_gti(deductions: dict[str, Decimal], gross_total_income: Decimal) -> dict[str, int]:
    """Validation rule 17/18: total Chapter VI-A cannot exceed GTI. Consumes
    GTI in the order the sections are listed."""
    remaining = max(ZERO, gross_total_income)
    restricted: dict[str, int] = {}
    for section, amount in deductions.items():
        allowed = min(amount, remaining)
        restricted[section] = int(allowed)
        remaining -= allowed
    return restricted


def _basic_exemption_limit(slabs: tuple) -> Decimal:
    for band in slabs:
        if band.rate == 0 and band.upto is not None:
            return band.upto
    return ZERO


def compute(draft: ItrDraftData, regime: Regime, rules: ItrYearRules, filing_date: date) -> ItrComputation:
    tax_rules = rules.tax_rules
    regime_rules = tax_rules.new_regime if regime == "new" else tax_rules.old_regime
    age_category = resolve_age_category(draft.personal.date_of_birth, rules.financial_year)
    is_senior = age_category != AgeCategory.GENERAL
    notes: list[str] = []

    # ---- Salary ----------------------------------------------------------
    s = draft.salary
    gross_salary = Decimal(s.salary_17_1 + s.perquisites_17_2 + s.profits_17_3)

    hra = _hra(draft) if regime == "old" else None
    exempt = Decimal(s.gratuity_exemption + s.leave_encashment_exemption)
    if regime == "old":
        exempt += Decimal(hra.exemption if hra else 0) + min(Decimal(s.lta_exemption), Decimal(s.salary_17_1))
    exempt = min(exempt, gross_salary)
    net_salary = gross_salary - exempt

    standard_deduction = min(net_salary, regime_rules.standard_deduction) if net_salary > 0 else ZERO
    professional_tax = (
        min(Decimal(s.professional_tax), rules.professional_tax_cap, net_salary - standard_deduction)
        if regime == "old"
        else ZERO
    )
    income_from_salary = max(ZERO, net_salary - standard_deduction - professional_tax)

    # ---- House property ---------------------------------------------------
    properties = _house_properties(draft, regime, rules)
    hp_total = Decimal(sum(p.income for p in properties))
    if regime == "old":
        hp_for_gti = max(hp_total, -rules.house_property_loss_setoff_cap)
    else:
        # Rule 160: in the new regime a house property loss is not set off against other heads.
        hp_for_gti = max(hp_total, ZERO)
        if hp_total < 0:
            notes.append("House property loss cannot be set off against other income in the new regime.")

    # ---- Other sources ----------------------------------------------------
    o = draft.other_income
    other_gross = Decimal(
        o.savings_interest
        + o.deposit_interest
        + o.refund_interest
        + o.family_pension
        + o.dividends.total
        + o.other_amount
    )
    fp_cap = rules.family_pension_cap_new if regime == "new" else rules.family_pension_cap_old
    family_pension_deduction = rupees(min(Decimal(o.family_pension) / 3, fp_cap))
    income_from_other_sources = other_gross - family_pension_deduction

    gross_total_income = income_from_salary + hp_for_gti + income_from_other_sources

    # ---- Chapter VI-A -----------------------------------------------------
    d = draft.deductions
    if regime == "old":
        ccd2_rate = (
            rules.rate_80ccd_2_govt
            if draft.personal.employer_category in _GOVT_EMPLOYERS
            else rules.rate_80ccd_2_old_private
        )
    else:
        ccd2_rate = rules.rate_80ccd_2_new
    ccd2 = min(Decimal(d.section_80ccd_2), rupees(Decimal(s.salary_17_1) * ccd2_rate))

    health_self = health_parents = HealthComputation(0, 0, 0, 0)
    raw: dict[str, Decimal] = {}
    if regime == "old":
        raw["80C"] = min(Decimal(sum(i.amount for i in d.section_80c)), rules.cap_80c)
        raw["80CCD(1B)"] = min(Decimal(d.section_80ccd_1b), rules.cap_80ccd_1b)
        raw["80CCD(2)"] = ccd2

        self_cap = rules.cap_80d_self_senior if d.health_self.includes_senior_citizen else rules.cap_80d_self
        parents_cap = (
            rules.cap_80d_parents_senior if d.health_parents.includes_senior_citizen else rules.cap_80d_parents
        )
        health_self, preventive_left = _health(d.health_self, self_cap, rules.cap_80d_preventive)
        health_parents, _ = _health(d.health_parents, parents_cap, preventive_left)
        raw["80D"] = Decimal(health_self.deduction + health_parents.deduction)

        if is_senior:
            raw["80TTB"] = min(Decimal(o.savings_interest + o.deposit_interest), rules.cap_80ttb)
        else:
            raw["80TTA"] = min(Decimal(o.savings_interest), rules.cap_80tta)
    else:
        raw["80CCD(2)"] = ccd2

    deductions = _restrict_to_gti({k: v for k, v in raw.items() if v > 0}, gross_total_income)
    chapter_via = Decimal(sum(deductions.values()))

    total_income = round_to_nearest_10(max(ZERO, gross_total_income - chapter_via))

    # ---- Tax --------------------------------------------------------------
    slabs = regime_rules.slabs_by_age[age_category]
    tax = rupees(calculate_slab_tax(total_income, slabs))
    rebate = rupees(apply_rebate(total_income, tax, regime_rules))
    tax_after_rebate = tax - rebate
    surcharge_cap = tax_rules.new_regime_surcharge_cap if regime == "new" else None
    surcharge = rupees(calculate_surcharge(total_income, tax_after_rebate, tax_rules.surcharge_bands, surcharge_cap))
    cess = rupees((tax_after_rebate + surcharge) * tax_rules.cess_rate)
    gross_tax_liability = tax_after_rebate + surcharge + cess

    # ---- Taxes paid -------------------------------------------------------
    tp = draft.taxes_paid
    tds = Decimal(sum(e.tds for e in s.employers) + sum(t.tds_claimed for t in tp.tds_other))
    tcs = Decimal(sum(t.amount_claimed for t in tp.tcs))
    advance_payments: list[interest.Payment] = []
    sat_payments: list[interest.Payment] = []
    for challan in tp.challans:
        if challan.date_of_deposit is None or challan.amount <= 0:
            continue
        payment = interest.Payment(challan.date_of_deposit, Decimal(challan.amount))
        if rules.fy_start <= challan.date_of_deposit <= rules.fy_end:
            advance_payments.append(payment)
        elif challan.date_of_deposit > rules.fy_end:
            sat_payments.append(payment)
    advance_tax = Decimal(sum(p.amount for p in advance_payments))
    self_assessment_tax = Decimal(sum(p.amount for p in sat_payments))

    # ---- Interest & fee ---------------------------------------------------
    assessed_tax = max(ZERO, gross_tax_liability - tds - tcs)
    i234a = interest.interest_234a(max(ZERO, assessed_tax - advance_tax), sat_payments, filing_date, rules)
    i234b = interest.interest_234b(assessed_tax, advance_tax, sat_payments, filing_date, rules)
    i234c = interest.interest_234c(assessed_tax, advance_payments, rules)
    f234f = interest.fee_234f(total_income, _basic_exemption_limit(slabs), filing_date, rules)

    total_tax_and_interest = gross_tax_liability + rupees(i234a + i234b + i234c) + f234f
    total_paid = tds + tcs + advance_tax + self_assessment_tax

    summary = RegimeComputation(
        regime=regime,
        gross_salary=int(gross_salary),
        exempt_allowances=int(exempt),
        net_salary=int(net_salary),
        standard_deduction=int(standard_deduction),
        professional_tax=int(professional_tax),
        income_from_salary=int(income_from_salary),
        income_from_house_property=int(hp_for_gti),
        income_from_other_sources=int(income_from_other_sources),
        family_pension_deduction=int(family_pension_deduction),
        gross_total_income=int(gross_total_income),
        chapter_via_deductions=int(chapter_via),
        deduction_breakup=deductions,
        total_income=int(total_income),
        tax_on_total_income=int(tax),
        rebate_87a=int(rebate),
        tax_after_rebate=int(tax_after_rebate),
        surcharge=int(surcharge),
        cess=int(cess),
        gross_tax_liability=int(gross_tax_liability),
        interest_234a=int(rupees(i234a)),
        interest_234b=int(rupees(i234b)),
        interest_234c=int(rupees(i234c)),
        fee_234f=int(f234f),
        total_tax_and_interest=int(total_tax_and_interest),
        tds=int(tds),
        tcs=int(tcs),
        advance_tax=int(advance_tax),
        self_assessment_tax=int(self_assessment_tax),
        total_taxes_paid=int(total_paid),
        refund_due=int(max(ZERO, total_paid - total_tax_and_interest)),
        balance_payable=int(max(ZERO, total_tax_and_interest - total_paid)),
    )

    return ItrComputation(
        regime=regime,
        age_category=age_category,
        filing_date=filing_date,
        hra=hra,
        properties=properties,
        house_property_total=int(hp_total),
        health_self=health_self,
        health_parents=health_parents,
        deductions=deductions,
        advance_tax_payments=advance_payments,
        self_assessment_payments=sat_payments,
        summary=summary,
        notes=notes,
    )
