"""
The three market-cap categories and the index fund that stands for each.

Index funds track the category's benchmark (SEBI: large cap = the 100 biggest
listed companies, mid cap = the next 150, small cap = the rest), so their
returns show what the category itself did, not one manager's picks. All three
are from one fund house so their history comes in a single AMFI download.
"""

from dataclasses import dataclass
from typing import Literal

Cap = Literal["large", "mid", "small"]

FUND_HOUSE = 55  # Motilal Oswal Mutual Fund, AMFI's fund-house code


@dataclass(frozen=True)
class CapCategory:
    cap: Cap
    label: str
    benchmark: str
    scheme_code: int
    scheme_name: str
    risk: Literal["Moderate", "High", "Very high"]
    what_it_is: str
    suits: str
    min_years: int


CATEGORIES: tuple[CapCategory, ...] = (
    CapCategory(
        cap="large",
        label="Large cap",
        benchmark="Nifty 50",
        scheme_code=147794,
        scheme_name="Motilal Oswal Nifty 50 Index Fund – Direct Growth",
        risk="Moderate",
        what_it_is="India's biggest, most established companies.",
        suits="Steadier growth with smaller falls; good as your core holding.",
        min_years=3,
    ),
    CapCategory(
        cap="mid",
        label="Mid cap",
        benchmark="Nifty Midcap 150",
        scheme_code=147622,
        scheme_name="Motilal Oswal Nifty Midcap 150 Index Fund – Direct Growth",
        risk="High",
        what_it_is="Growing companies ranked 101 to 250 by size.",
        suits="Faster growth than large caps, with bigger ups and downs.",
        min_years=5,
    ),
    CapCategory(
        cap="small",
        label="Small cap",
        benchmark="Nifty Smallcap 250",
        scheme_code=147623,
        scheme_name="Motilal Oswal Nifty Smallcap 250 Index Fund – Direct Growth",
        risk="Very high",
        what_it_is="Smaller companies ranked 251 and below.",
        suits="The highest growth potential, but can fall 30–50% in a bad year.",
        min_years=7,
    ),
)

SCHEME_CODES = {c.scheme_code for c in CATEGORIES}


@dataclass(frozen=True)
class FundList:
    """An AMFI category whose funds are listed with their returns."""

    id: Literal["large", "mid", "small", "elss"]
    label: str
    # Matched against the end of AMFI's heading, e.g. "Equity Scheme - Large Cap Fund".
    amfi_suffixes: tuple[str, ...]
    note: str | None = None


FUND_LISTS: tuple[FundList, ...] = (
    FundList("large", "Large cap", ("- Large Cap Fund",)),
    FundList("mid", "Mid cap", ("- Mid Cap Fund",)),
    FundList("small", "Small cap", ("- Small Cap Fund",)),
    FundList(
        "elss", "Tax saver (ELSS)", ("- ELSS", "- ELSS- Tax Saver Fund"),
        note="Saves tax under Section 80C in the old regime only; 3-year lock-in.",
    ),
)


def fund_list_for(amfi_category: str) -> FundList | None:
    for fund_list in FUND_LISTS:
        if any(amfi_category.endswith(suffix) for suffix in fund_list.amfi_suffixes):
            return fund_list
    return None
