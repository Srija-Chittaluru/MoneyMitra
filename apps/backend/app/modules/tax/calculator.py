from dataclasses import dataclass
from decimal import Decimal

from app.modules.tax.money import round_to_nearest_10
from app.modules.tax.rules.types import AgeCategory, RegimeRules, SurchargeBand, TaxYearRules

ZERO = Decimal("0")


@dataclass(frozen=True)
class RegimeCalculation:
    regime: str
    gross_total_income: Decimal
    total_deductions: Decimal
    taxable_income: Decimal
    tax_before_rebate: Decimal
    rebate: Decimal
    tax_after_rebate: Decimal
    surcharge: Decimal
    cess: Decimal
    total_tax_payable: Decimal


def calculate_slab_tax(taxable_income: Decimal, slabs: tuple) -> Decimal:
    tax = ZERO
    lower = ZERO
    for band in slabs:
        upper = band.upto if band.upto is not None else taxable_income
        if taxable_income <= lower:
            break
        band_income = min(taxable_income, upper) - lower
        if band_income > 0:
            tax += band_income * band.rate
        lower = upper
    return tax


def apply_rebate(taxable_income: Decimal, tax_before_rebate: Decimal, rules: RegimeRules) -> Decimal:
    """Returns the rebate amount (section 87A), honoring marginal relief
    where the regime's rules specify it."""
    if taxable_income <= rules.rebate_income_limit:
        if rules.rebate_max_amount is None:
            return tax_before_rebate
        return min(tax_before_rebate, rules.rebate_max_amount)

    if rules.marginal_relief_on_rebate:
        excess_income = taxable_income - rules.rebate_income_limit
        if tax_before_rebate > excess_income:
            return tax_before_rebate - excess_income

    return ZERO


def calculate_surcharge(
    taxable_income: Decimal,
    tax_after_rebate: Decimal,
    bands: tuple[SurchargeBand, ...],
    cap: Decimal | None,
) -> Decimal:
    rate = ZERO
    for band in bands:
        if taxable_income > band.above:
            rate = band.rate
    if cap is not None and rate > cap:
        rate = cap
    return tax_after_rebate * rate


def _calculate_regime(
    regime: str,
    gross_total_income: Decimal,
    deductions: Decimal,
    age_category: AgeCategory,
    regime_rules: RegimeRules,
    year_rules: TaxYearRules,
) -> RegimeCalculation:
    total_deductions = regime_rules.standard_deduction + deductions
    taxable_income = round_to_nearest_10(max(ZERO, gross_total_income - total_deductions))

    slabs = regime_rules.slabs_by_age[age_category]
    tax_before_rebate = calculate_slab_tax(taxable_income, slabs)

    rebate = apply_rebate(taxable_income, tax_before_rebate, regime_rules)
    tax_after_rebate = tax_before_rebate - rebate

    surcharge_cap = year_rules.new_regime_surcharge_cap if regime == "new" else None
    surcharge = calculate_surcharge(taxable_income, tax_after_rebate, year_rules.surcharge_bands, surcharge_cap)

    cess = (tax_after_rebate + surcharge) * year_rules.cess_rate
    total_tax_payable = round_to_nearest_10(tax_after_rebate + surcharge + cess)

    return RegimeCalculation(
        regime=regime,
        gross_total_income=gross_total_income,
        total_deductions=total_deductions,
        taxable_income=taxable_income,
        tax_before_rebate=tax_before_rebate,
        rebate=rebate,
        tax_after_rebate=tax_after_rebate,
        surcharge=surcharge,
        cess=cess,
        total_tax_payable=total_tax_payable,
    )


def calculate_old_regime(
    gross_total_income: Decimal,
    old_regime_deductions: Decimal,
    age_category: AgeCategory,
    year_rules: TaxYearRules,
) -> RegimeCalculation:
    return _calculate_regime(
        "old", gross_total_income, old_regime_deductions, age_category, year_rules.old_regime, year_rules
    )


def calculate_new_regime(
    gross_total_income: Decimal,
    age_category: AgeCategory,
    year_rules: TaxYearRules,
) -> RegimeCalculation:
    # New regime does not allow 80C/80D/HRA/other deductions — only the
    # standard deduction, which _calculate_regime already applies.
    return _calculate_regime(
        "new", gross_total_income, ZERO, age_category, year_rules.new_regime, year_rules
    )


def compare_regimes(old: RegimeCalculation, new: RegimeCalculation) -> str:
    if old.total_tax_payable < new.total_tax_payable:
        return "old"
    if new.total_tax_payable < old.total_tax_payable:
        return "new"
    return "either"
