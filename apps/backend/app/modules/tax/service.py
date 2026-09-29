from decimal import Decimal

from fastapi import HTTPException, status

from app.modules.tax import calculator
from app.modules.tax.age import resolve_age_category
from app.modules.tax.rules.registry import get_supported_tax_years, get_tax_rules
from app.modules.tax.rules.types import AgeCategory
from app.modules.tax.schemas import RegimeResult, TaxComparisonInput, TaxComparisonResult

_SECTION_80C_CAP = Decimal("150000")
_SECTION_80D_CAP_GENERAL = Decimal("25000")
_SECTION_80D_CAP_SENIOR = Decimal("50000")


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
    )
