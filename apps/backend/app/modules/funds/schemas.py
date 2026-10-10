from datetime import date
from typing import Literal

from pydantic import BaseModel

Cap = Literal["large", "mid", "small"]


class NavPointOut(BaseModel):
    date: date
    nav: float


class CapReturns(BaseModel):
    """Compound annual growth, % a year; null when the fund isn't that old."""

    one_year: float | None
    three_year: float | None
    five_year: float | None


class CapCategoryOut(BaseModel):
    cap: Cap
    label: str
    benchmark: str
    scheme_code: int
    scheme_name: str
    risk: Literal["Moderate", "High", "Very high"]
    what_it_is: str
    suits: str
    min_years: int
    latest_nav: float
    latest_nav_date: date
    returns: CapReturns
    # Largest fall from a high to a later low, month-end NAVs, as a negative %.
    worst_fall: float
    history: list[NavPointOut]


class FundReturnsRow(BaseModel):
    scheme_code: int
    name: str
    nav: float
    one_year: float | None
    three_year: float | None
    five_year: float | None


class FundListOut(BaseModel):
    """Every fund (or ETF) in a group, best 3-year return first."""

    id: str
    label: str
    note: str | None
    average: CapReturns
    funds: list[FundReturnsRow]


class CapMix(BaseModel):
    large: int
    mid: int
    small: int


class CapRecommendation(BaseModel):
    cap: Cap
    title: str
    reasons: list[str]
    mix: CapMix
    # A starting SIP of about 10% of monthly income, when income is known.
    monthly_sip: int | None
    years_to_invest: int
    basis: str


class MutualFundsOut(BaseModel):
    categories: list[CapCategoryOut]
    fund_lists: list[FundListOut]
    fund_lists_as_of: date
    # Null until the user's age is known: risk can't be judged without it.
    recommendation: CapRecommendation | None
    missing: list[Literal["date_of_birth", "income"]]
    as_of: date
    # True when AMFI's latest NAV file was reached; false means the bundled snapshot only.
    live: bool
    source: str
    disclaimer: str


class EtfBenchmarkOut(BaseModel):
    id: Literal["nifty50", "gold", "silver"]
    label: str
    scheme_name: str
    latest_nav: float
    latest_nav_date: date
    returns: CapReturns
    worst_fall: float
    history: list[NavPointOut]


class EtfMix(BaseModel):
    nifty50: int
    gold: int
    silver: int


class EtfsOut(BaseModel):
    lists: list[FundListOut]
    benchmarks: list[EtfBenchmarkOut]
    # A Nifty 50 / gold / silver split for the user's age; null until it's known.
    mix: EtfMix | None
    mix_basis: str | None
    tips: list[str]
    as_of: date
    source: str
    disclaimer: str
