from app.modules.tax.rules.fy_2025_26 import TAX_YEAR_2025_26
from app.modules.tax.rules.fy_2026_27 import TAX_YEAR_2026_27
from app.modules.tax.rules.types import TaxYearRules

TAX_RULES_REGISTRY: dict[str, TaxYearRules] = {
    TAX_YEAR_2025_26.tax_year: TAX_YEAR_2025_26,
    TAX_YEAR_2026_27.tax_year: TAX_YEAR_2026_27,
}


def get_supported_tax_years() -> list[str]:
    return sorted(TAX_RULES_REGISTRY.keys())


def get_tax_rules(tax_year: str) -> TaxYearRules | None:
    return TAX_RULES_REGISTRY.get(tax_year)
