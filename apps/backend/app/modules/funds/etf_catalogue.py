"""
The ETF groups MoneyMitra lists, and the three ETFs whose history is charted.

ETFs are grouped by what they track, read from AMFI's category heading and the
scheme name (AMFI files every equity ETF under one heading).
"""

import re
from dataclasses import dataclass
from typing import Literal

EtfListId = Literal["nifty50", "bank", "it", "gold", "silver"]

_EXCLUDE = re.compile(r"\b(fof|fund of funds?)\b", re.IGNORECASE)
# Narrower bank indices aren't "Bank Nifty".
_NOT_BANK_NIFTY = re.compile(r"\b(psu|private|pvt)\b", re.IGNORECASE)


@dataclass(frozen=True)
class EtfList:
    id: EtfListId
    label: str
    note: str
    pattern: re.Pattern


ETF_LISTS: tuple[EtfList, ...] = (
    EtfList(
        "nifty50", "Nifty 50",
        "India's 50 biggest companies in one buy; the usual core holding.",
        # "Nifty 50" exactly: not Next 50, Nifty 500, or factor/strategy variants of it.
        re.compile(r"nifty\s*50\b(?!\s*(equal|value|shariah|dividend|alpha|quality|low|momentum))(?!.*next)", re.IGNORECASE),
    ),
    EtfList(
        "bank", "Bank",
        "The 12 biggest banks only. Concentrated: keep it a small part of what you invest.",
        re.compile(r"(nifty\s*bank|bank\s*bees)\b", re.IGNORECASE),
    ),
    EtfList(
        "it", "IT",
        "India's largest IT companies only. Concentrated: keep it a small part of what you invest.",
        re.compile(r"(nifty\s*it|\bit\s*bees|\bit\s+etf)\b", re.IGNORECASE),
    ),
    EtfList(
        "gold", "Gold",
        "Tracks the price of gold. Often rises when shares fall, so 5–10% can steady your investments.",
        re.compile(r"\bgold\b", re.IGNORECASE),
    ),
    EtfList(
        "silver", "Silver",
        "Tracks the price of silver. Swings more than gold; keep it small.",
        re.compile(r"\bsilver\b", re.IGNORECASE),
    ),
)


def etf_list_for(category: str, name: str) -> EtfList | None:
    if "ETF" not in category or _EXCLUDE.search(name):
        return None
    for etf_list in ETF_LISTS:
        if etf_list.pattern.search(name):
            if etf_list.id == "bank" and _NOT_BANK_NIFTY.search(name):
                return None
            return etf_list
    return None


@dataclass(frozen=True)
class Benchmark:
    id: Literal["nifty50", "gold", "silver"]
    label: str
    scheme_code: int
    scheme_name: str
    fund_house: int  # AMFI fund-house code, for the history download


# The longest-running, most traded ETF of each kind.
BENCHMARKS: tuple[Benchmark, ...] = (
    Benchmark("nifty50", "Nifty 50", 140084, "Nippon India ETF Nifty 50 BeES", 21),
    Benchmark("gold", "Gold", 140088, "Nippon India ETF Gold BeES", 21),
    Benchmark("silver", "Silver", 149464, "ICICI Prudential Silver ETF", 20),
)
