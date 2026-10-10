"""
ETFs: every Nifty 50, Bank, IT, Gold and Silver ETF with its returns, the
history of equity vs gold vs silver, and a simple split for the user's age.
From the AMFI snapshot built by scripts/fetch_amfi_etfs.py (split-adjusted).
"""

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from app.modules.funds.etf_catalogue import BENCHMARKS, ETF_LISTS
from app.modules.funds.schemas import (
    CapReturns,
    EtfBenchmarkOut,
    EtfMix,
    EtfsOut,
    FundListOut,
    FundReturnsRow,
    NavPointOut,
)
from app.modules.funds.service import _average, worst_fall
from app.modules.recommendations.stages import calculate_age
from app.modules.users.models import User

SNAPSHOT = Path(__file__).parent / "data" / "amfi_etf_returns.json"

DISCLAIMER = (
    "ETFs are bought and sold on the stock exchange through a demat account, at the market price, which can differ "
    "slightly from the NAV shown. Past returns don't guarantee future returns. This is general information, not "
    "advice to buy any ETF."
)


@lru_cache
def _snapshot() -> dict:
    return json.loads(SNAPSHOT.read_text())


def _lists() -> list[FundListOut]:
    lists = _snapshot()["lists"]
    out = []
    for etf_list in ETF_LISTS:
        rows = [FundReturnsRow(**row) for row in lists.get(etf_list.id, [])]
        rows.sort(key=lambda r: (r.three_year is None, -(r.three_year or 0), -(r.one_year or 0)))
        out.append(FundListOut(
            id=etf_list.id, label=etf_list.label, note=etf_list.note,
            average=CapReturns(**{k: _average(rows, k) for k in ("one_year", "three_year", "five_year")}),
            funds=rows,
        ))
    return out


def _benchmarks() -> list[EtfBenchmarkOut]:
    # Returns come from the same exact-date figures as the ETF table, so a tile and
    # its row never disagree; the month-end history is only for the chart and worst fall.
    rows = {row["scheme_code"]: row for group in _snapshot()["lists"].values() for row in group}
    out = []
    for benchmark in BENCHMARKS:
        row = rows[benchmark.scheme_code]
        history = [NavPointOut(date=date.fromisoformat(d), nav=nav) for d, nav in _snapshot()["history"][str(benchmark.scheme_code)]]
        out.append(EtfBenchmarkOut(
            id=benchmark.id, label=benchmark.label, scheme_name=benchmark.scheme_name,
            latest_nav=history[-1].nav, latest_nav_date=history[-1].date,
            returns=CapReturns(one_year=row["one_year"], three_year=row["three_year"], five_year=row["five_year"]),
            worst_fall=worst_fall(history), history=history,
        ))
    return out


def mix_for(age: int | None) -> EtfMix | None:
    """More gold as you get older, to cushion falls in shares; silver stays small."""
    if age is None:
        return None
    if age < 35:
        return EtfMix(nifty50=85, gold=10, silver=5)
    if age < 50:
        return EtfMix(nifty50=80, gold=15, silver=5)
    return EtfMix(nifty50=70, gold=25, silver=5)


TIPS = [
    "A Nifty 50 ETF is the simplest core holding: India's 50 biggest companies, at a very low cost.",
    "Gold often rises when shares fall. Keeping 5–15% in a gold ETF steadies your investments.",
    "Bank and IT ETFs bet on one industry. Keep them a small part of what you invest, if at all.",
    "No demat account? A Nifty 50 index mutual fund (see Mutual Funds) does the same job, with automatic monthly SIPs.",
]


def get_etfs(user: User, today: date | None = None) -> EtfsOut:
    today = today or date.today()
    age = calculate_age(user.date_of_birth, today) if user.date_of_birth else None
    return EtfsOut(
        lists=_lists(),
        benchmarks=_benchmarks(),
        mix=mix_for(age),
        mix_basis=f"Based on your age ({age})" if age is not None else None,
        tips=TIPS,
        as_of=date.fromisoformat(_snapshot()["as_of"]),
        source="AMFI (Association of Mutual Funds in India)",
        disclaimer=DISCLAIMER,
    )
