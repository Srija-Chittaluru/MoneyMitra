"""
Rules for FY 2026-27 (AY 2027-28).

Budget 2026 made no changes to slab rates, standard deduction amounts, or
Section 87A rebate thresholds for either regime — so these rules are
identical to FY 2025-26. Re-verify against official Income Tax Department
circulars before relying on this for real filings.
"""

from decimal import Decimal

from app.modules.tax.rules.fy_2025_26 import NEW_REGIME_2025_26, OLD_REGIME_2025_26
from app.modules.tax.rules.types import SurchargeBand, TaxYearRules

TAX_YEAR_2026_27 = TaxYearRules(
    tax_year="2026-27",
    old_regime=OLD_REGIME_2025_26,
    new_regime=NEW_REGIME_2025_26,
    cess_rate=Decimal("0.04"),
    surcharge_bands=(
        SurchargeBand(Decimal("5000000"), Decimal("0.10")),
        SurchargeBand(Decimal("10000000"), Decimal("0.15")),
        SurchargeBand(Decimal("20000000"), Decimal("0.25")),
        SurchargeBand(Decimal("50000000"), Decimal("0.37")),
    ),
    new_regime_surcharge_cap=Decimal("0.25"),
)
