"""
Rules for FY 2025-26 (AY 2026-27), per Union Budget 2025.

These values were proposed by the assistant and explicitly confirmed by the
product owner before implementation (see Phase 3 kickoff). They should still
be independently verified against an authoritative source (official Income
Tax Department circulars) before this is used for real filings — MoneyMitra
presents this as an estimate, not filing-ready advice.

Known simplifications, disclosed deliberately (not silent):
- Surcharge is slab-based without marginal relief smoothing at the
  threshold crossings (only affects taxable income above Rs 50L).
- 80D is a flat cap per age category; the additional deduction for parents'
  health insurance premiums is not modeled.
- HRA exemption and "other deductions" are accepted as user-asserted
  amounts, not derived from salary structure/rent — that derivation
  belongs to the future document-extraction pipeline.
"""

from decimal import Decimal

from app.modules.tax.rules.types import (
    AgeCategory,
    RegimeRules,
    SlabBand,
    SurchargeBand,
    TaxYearRules,
)

_D = Decimal

# Old regime slabs vary by age category.
_OLD_GENERAL_SLABS = (
    SlabBand(_D("250000"), _D("0")),
    SlabBand(_D("500000"), _D("0.05")),
    SlabBand(_D("1000000"), _D("0.20")),
    SlabBand(None, _D("0.30")),
)
_OLD_SENIOR_SLABS = (
    SlabBand(_D("300000"), _D("0")),
    SlabBand(_D("500000"), _D("0.05")),
    SlabBand(_D("1000000"), _D("0.20")),
    SlabBand(None, _D("0.30")),
)
_OLD_SUPER_SENIOR_SLABS = (
    SlabBand(_D("500000"), _D("0")),
    SlabBand(_D("1000000"), _D("0.20")),
    SlabBand(None, _D("0.30")),
)

# New regime slabs are the same for every age category.
_NEW_SLABS = (
    SlabBand(_D("400000"), _D("0")),
    SlabBand(_D("800000"), _D("0.05")),
    SlabBand(_D("1200000"), _D("0.10")),
    SlabBand(_D("1600000"), _D("0.15")),
    SlabBand(_D("2000000"), _D("0.20")),
    SlabBand(_D("2400000"), _D("0.25")),
    SlabBand(None, _D("0.30")),
)

OLD_REGIME_2025_26 = RegimeRules(
    slabs_by_age={
        AgeCategory.GENERAL: _OLD_GENERAL_SLABS,
        AgeCategory.SENIOR: _OLD_SENIOR_SLABS,
        AgeCategory.SUPER_SENIOR: _OLD_SUPER_SENIOR_SLABS,
    },
    standard_deduction=_D("50000"),
    rebate_income_limit=_D("500000"),
    rebate_max_amount=_D("12500"),
    marginal_relief_on_rebate=False,
)

NEW_REGIME_2025_26 = RegimeRules(
    slabs_by_age={
        AgeCategory.GENERAL: _NEW_SLABS,
        AgeCategory.SENIOR: _NEW_SLABS,
        AgeCategory.SUPER_SENIOR: _NEW_SLABS,
    },
    standard_deduction=_D("75000"),
    rebate_income_limit=_D("1200000"),
    rebate_max_amount=None,
    marginal_relief_on_rebate=True,
)

TAX_YEAR_2025_26 = TaxYearRules(
    tax_year="2025-26",
    old_regime=OLD_REGIME_2025_26,
    new_regime=NEW_REGIME_2025_26,
    cess_rate=_D("0.04"),
    surcharge_bands=(
        SurchargeBand(_D("5000000"), _D("0.10")),
        SurchargeBand(_D("10000000"), _D("0.15")),
        SurchargeBand(_D("20000000"), _D("0.25")),
        SurchargeBand(_D("50000000"), _D("0.37")),
    ),
    new_regime_surcharge_cap=_D("0.25"),
)
