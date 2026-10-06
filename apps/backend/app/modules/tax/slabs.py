"""
Static slab-rate reference table — the rates themselves, independent of any
specific income. Shown before/alongside a calculation (unlike RegimeResult's
slab_breakdown, which is the worked bracket-by-bracket tax for one person's
actual taxable income). Reads straight from the registered rules so this can
never drift from what the calculator actually does.
"""

from decimal import Decimal

from fastapi import HTTPException, status

from app.modules.tax.rules.registry import get_supported_tax_years, get_tax_rules
from app.modules.tax.rules.types import AgeCategory, SlabBand
from app.modules.tax.schemas import SlabRateOut, SlabTableOut

ZERO = Decimal("0")


def _slab_rates(slabs: tuple[SlabBand, ...]) -> list[SlabRateOut]:
    rates = []
    lower = ZERO
    for band in slabs:
        rates.append(
            SlabRateOut(
                lower=int(lower),
                upper=int(band.upto) if band.upto is not None else None,
                rate=float(band.rate),
            )
        )
        if band.upto is None:
            break
        lower = band.upto
    return rates


def get_slab_table(tax_year: str, age_category: AgeCategory) -> SlabTableOut:
    year_rules = get_tax_rules(tax_year)
    if year_rules is None:
        supported = ", ".join(get_supported_tax_years())
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported tax year '{tax_year}'. Supported years: {supported}",
        )

    return SlabTableOut(
        tax_year=tax_year,
        age_category=age_category.value,
        old_regime=_slab_rates(year_rules.old_regime.slabs_by_age[age_category]),
        new_regime=_slab_rates(year_rules.new_regime.slabs_by_age[age_category]),
    )
