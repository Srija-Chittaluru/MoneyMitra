from decimal import Decimal

from fastapi import HTTPException, status

from app.modules.tax import calculator
from app.modules.tax.age import resolve_age_category
from app.modules.tax.instruments import QUALIFYING_INSTRUMENTS, SECTION_LABELS, DeductionSection
from app.modules.tax.rules.registry import get_supported_tax_years, get_tax_rules
from app.modules.tax.rules.types import AgeCategory
from app.modules.tax.schemas import (
    DeductionSectionBreakdown,
    RegimeResult,
    TaxComparisonInput,
    TaxComparisonResult,
)

ZERO = Decimal("0")

_SECTION_80C_CAP = Decimal("150000")
_SECTION_80D_CAP_GENERAL = Decimal("25000")
_SECTION_80D_CAP_SENIOR = Decimal("50000")
_SECTION_24B_CAP = Decimal("200000")
_SECTION_80CCD_1B_CAP = Decimal("50000")


def _regime_result(calc: calculator.RegimeCalculation) -> RegimeResult:
    return RegimeResult(
        regime=calc.regime,
        gross_total_income=int(calc.gross_total_income),
        total_deductions=int(calc.total_deductions),
        taxable_income=int(calc.taxable_income),
        tax_before_rebate=int(calc.tax_before_rebate),
        rebate=int(calc.rebate),
        tax_after_rebate=int(calc.tax_after_rebate),
        surcharge=int(calc.surcharge),
        cess=int(calc.cess),
        total_tax_payable=int(calc.total_tax_payable),
    )


def _section_breakdown(
    section: DeductionSection, declared: Decimal, limit: Decimal | None
) -> DeductionSectionBreakdown:
    label = SECTION_LABELS[section]
    instruments = QUALIFYING_INSTRUMENTS[section]

    if limit is None:
        return DeductionSectionBreakdown(
            section=section.value,
            label=label,
            limit=None,
            declared_amount=int(declared),
            headroom=None,
            qualifying_instruments=instruments,
            note=(
                "No flat cap — the real exemption depends on salary structure, rent paid, "
                "and city, and isn't independently verified here."
            ),
        )

    headroom = max(ZERO, limit - min(declared, limit))
    note = None
    if declared > limit:
        note = f"Declared amount exceeds the ₹{int(limit):,} limit; only ₹{int(limit):,} is deductible."

    return DeductionSectionBreakdown(
        section=section.value,
        label=label,
        limit=int(limit),
        declared_amount=int(declared),
        headroom=int(headroom),
        qualifying_instruments=instruments,
        note=note,
    )


def build_deduction_checklist(
    payload: TaxComparisonInput, age_category: AgeCategory
) -> list[DeductionSectionBreakdown]:
    section_80d_cap = (
        _SECTION_80D_CAP_GENERAL if age_category == AgeCategory.GENERAL else _SECTION_80D_CAP_SENIOR
    )
    return [
        _section_breakdown(DeductionSection.SECTION_80C, Decimal(payload.section_80c), _SECTION_80C_CAP),
        _section_breakdown(DeductionSection.SECTION_80D, Decimal(payload.section_80d), section_80d_cap),
        _section_breakdown(DeductionSection.HRA, Decimal(payload.hra_exemption), None),
        _section_breakdown(
            DeductionSection.SECTION_24B, Decimal(payload.home_loan_interest), _SECTION_24B_CAP
        ),
        _section_breakdown(
            DeductionSection.SECTION_80CCD_1B, Decimal(payload.nps_contribution), _SECTION_80CCD_1B_CAP
        ),
    ]


def calculate_comparison(payload: TaxComparisonInput) -> TaxComparisonResult:
    year_rules = get_tax_rules(payload.tax_year)
    if year_rules is None:
        supported = ", ".join(get_supported_tax_years())
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported tax year '{payload.tax_year}'. Supported years: {supported}",
        )

    age_category = resolve_age_category(payload.date_of_birth, payload.tax_year)

    gross_total_income = Decimal(payload.gross_total_income)

    section_80d_cap = (
        _SECTION_80D_CAP_GENERAL if age_category == AgeCategory.GENERAL else _SECTION_80D_CAP_SENIOR
    )
    old_regime_deductions = (
        min(Decimal(payload.section_80c), _SECTION_80C_CAP)
        + min(Decimal(payload.section_80d), section_80d_cap)
        + Decimal(payload.hra_exemption)
        + min(Decimal(payload.home_loan_interest), _SECTION_24B_CAP)
        + min(Decimal(payload.nps_contribution), _SECTION_80CCD_1B_CAP)
        + Decimal(payload.other_deductions)
    )

    old = calculator.calculate_old_regime(gross_total_income, old_regime_deductions, age_category, year_rules)
    new = calculator.calculate_new_regime(gross_total_income, age_category, year_rules)
    recommended = calculator.compare_regimes(old, new)
    difference = abs(old.total_tax_payable - new.total_tax_payable)

    return TaxComparisonResult(
        tax_year=payload.tax_year,
        old_regime=_regime_result(old),
        new_regime=_regime_result(new),
        recommended_regime=recommended,
        difference=int(difference),
        deduction_checklist=build_deduction_checklist(payload, age_category),
    )
