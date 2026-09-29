from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class AgeCategory(str, Enum):
    GENERAL = "general"  # below 60
    SENIOR = "senior"  # 60 to below 80
    SUPER_SENIOR = "super_senior"  # 80 and above


@dataclass(frozen=True)
class SlabBand:
    """A slab from the previous band's upper bound up to (and including) `upto`.
    `upto=None` means unbounded (the top slab)."""

    upto: Decimal | None
    rate: Decimal


@dataclass(frozen=True)
class SurchargeBand:
    above: Decimal
    rate: Decimal


@dataclass(frozen=True)
class RegimeRules:
    slabs_by_age: dict[AgeCategory, tuple[SlabBand, ...]]
    standard_deduction: Decimal
    rebate_income_limit: Decimal
    rebate_max_amount: Decimal | None
    """None means the rebate can fully zero out the tax (subject to marginal
    relief where applicable); a numeric cap means the rebate is limited to
    that amount."""
    marginal_relief_on_rebate: bool


@dataclass(frozen=True)
class TaxYearRules:
    tax_year: str
    old_regime: RegimeRules
    new_regime: RegimeRules
    cess_rate: Decimal
    surcharge_bands: tuple[SurchargeBand, ...]
    new_regime_surcharge_cap: Decimal
