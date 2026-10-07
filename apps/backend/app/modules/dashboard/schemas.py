from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class RegimeSummary(BaseModel):
    old_tax: int
    new_tax: int
    better: Literal["old", "new", "either"]
    difference: int


class EstimatedTax(BaseModel):
    regime: Literal["old", "new"]
    amount: int


class DashboardSummary(BaseModel):
    """What MoneyMitra actually knows about the user's money — nothing is assumed.

    Every field is null until the user has provided the data it is calculated
    from: `annual_income` and `regime` come from their latest ITR draft (which
    uploaded documents fill in) or saved tax comparison, whichever is newer.
    `regime` (the old-vs-new comparison) is null when both regimes can't be
    compared, e.g. a belated return where only the new regime applies;
    `estimated_tax` is still given then, under the regime that does apply.
    """

    source: Literal["itr_filing", "tax_comparison"] | None
    annual_income: int | None
    estimated_tax: EstimatedTax | None
    regime: RegimeSummary | None
    updated_at: datetime | None
