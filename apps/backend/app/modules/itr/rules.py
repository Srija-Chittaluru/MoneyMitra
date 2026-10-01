"""
ITR-1 filing rules per assessment year.

Slabs, rebate, surcharge and cess are NOT duplicated here — they come from
the tax module's `TaxYearRules` for the matching financial year. This file
only holds what is specific to filing a return: due dates, deduction caps
and the official JSON schema version.

AY 2026-27 values are taken from the CBDT "ITR 1 – Validation Rules for
AY 2026-27" (v1.0, 15 May 2026) and the ITR-1 JSON schema v1.1 published on
incometax.gov.in. When a new assessment year is notified, add a new
`ItrYearRules` instance (and its schema file under `official/`) — do not
edit an existing year's values.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.modules.tax.rules.registry import get_tax_rules
from app.modules.tax.rules.types import TaxYearRules

_D = Decimal


@dataclass(frozen=True)
class ItrYearRules:
    assessment_year: str  # "2026-27"
    financial_year: str  # "2025-26" — key into the tax rules registry
    schema_file: str
    schema_assessment_year: str  # value of Form_ITR1.AssessmentYear, e.g. "2026"
    schema_version: str
    form_version: str

    fy_start: date
    fy_end: date
    due_date: date  # section 139(1)
    belated_deadline: date  # section 139(4)

    itr1_total_income_limit: Decimal
    max_house_properties: int
    agricultural_income_limit: Decimal

    # Section 16
    professional_tax_cap: Decimal

    # House property
    self_occupied_interest_cap: Decimal  # old regime only
    house_property_loss_setoff_cap: Decimal  # old regime only
    house_property_standard_deduction_rate: Decimal

    # Section 57(iia) family pension deduction: lower of 1/3rd or the cap
    family_pension_cap_old: Decimal
    family_pension_cap_new: Decimal

    # Chapter VI-A
    cap_80c: Decimal  # combined 80C + 80CCC + 80CCD(1)
    cap_80ccd_1b: Decimal
    rate_80ccd_2_old_private: Decimal
    rate_80ccd_2_govt: Decimal
    rate_80ccd_2_new: Decimal
    cap_80d_self: Decimal
    cap_80d_self_senior: Decimal
    cap_80d_parents: Decimal
    cap_80d_parents_senior: Decimal
    cap_80d_preventive: Decimal
    cap_80tta: Decimal
    cap_80ttb: Decimal

    # Interest / fee
    interest_threshold_234b_234c: Decimal  # no 234B/234C when assessed tax is below this
    fee_234f_small: Decimal  # total income <= 5L
    fee_234f_large: Decimal
    fee_234f_small_income_limit: Decimal

    @property
    def tax_rules(self) -> TaxYearRules:
        rules = get_tax_rules(self.financial_year)
        if rules is None:  # pragma: no cover — guarded by a test
            raise RuntimeError(f"No tax rules registered for FY {self.financial_year}")
        return rules


AY_2026_27 = ItrYearRules(
    assessment_year="2026-27",
    financial_year="2025-26",
    schema_file="ITR-1_AY2026-27_V1.1.json",
    schema_assessment_year="2026",
    schema_version="Ver1.0",
    form_version="Ver1.0",
    fy_start=date(2025, 4, 1),
    fy_end=date(2026, 3, 31),
    due_date=date(2026, 7, 31),
    belated_deadline=date(2026, 12, 31),
    itr1_total_income_limit=_D("5000000"),
    max_house_properties=2,
    agricultural_income_limit=_D("5000"),
    professional_tax_cap=_D("5000"),
    self_occupied_interest_cap=_D("200000"),
    house_property_loss_setoff_cap=_D("200000"),
    house_property_standard_deduction_rate=_D("0.30"),
    family_pension_cap_old=_D("15000"),
    family_pension_cap_new=_D("25000"),
    cap_80c=_D("150000"),
    cap_80ccd_1b=_D("50000"),
    rate_80ccd_2_old_private=_D("0.10"),
    rate_80ccd_2_govt=_D("0.14"),
    rate_80ccd_2_new=_D("0.14"),
    cap_80d_self=_D("25000"),
    cap_80d_self_senior=_D("50000"),
    cap_80d_parents=_D("25000"),
    cap_80d_parents_senior=_D("50000"),
    cap_80d_preventive=_D("5000"),
    cap_80tta=_D("10000"),
    cap_80ttb=_D("50000"),
    interest_threshold_234b_234c=_D("10000"),
    fee_234f_small=_D("1000"),
    fee_234f_large=_D("5000"),
    fee_234f_small_income_limit=_D("500000"),
)

ITR_RULES_REGISTRY: dict[str, ItrYearRules] = {
    AY_2026_27.assessment_year: AY_2026_27,
}


def get_supported_assessment_years() -> list[str]:
    return sorted(ITR_RULES_REGISTRY.keys())


def get_itr_rules(assessment_year: str) -> ItrYearRules | None:
    return ITR_RULES_REGISTRY.get(assessment_year)
