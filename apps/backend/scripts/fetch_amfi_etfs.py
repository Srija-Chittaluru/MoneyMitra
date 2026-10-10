"""
Builds the ETF snapshot: every Nifty 50, Bank, IT, Gold and Silver ETF with its
1, 3 and 5-year returns, plus month-end history for the charted ETFs. Run from
apps/backend:

    python -m scripts.fetch_amfi_etfs
"""

import json
from datetime import date
from pathlib import Path

from app.modules.funds.amfi import fetch_latest_schemes
from app.modules.funds.etf_catalogue import BENCHMARKS, etf_list_for
from app.modules.funds.snapshot import (
    adjust_history_for_splits,
    adjust_returns_for_splits,
    month_end_history,
    returns_rows,
    years_before,
)

OUT = Path(__file__).resolve().parents[1] / "app/modules/funds/data/amfi_etf_returns.json"
HISTORY_YEARS = 7


def main() -> None:
    schemes = [s for s in fetch_latest_schemes(direct_growth_only=False) if etf_list_for(s.category, s.name)]
    as_of = max(s.on for s in schemes)
    schemes = [s for s in schemes if (as_of - s.on).days <= 7]
    print(f"{len(schemes)} ETFs, NAVs as of {as_of}")

    list_of = {s.scheme_code: etf_list_for(s.category, s.name).id for s in schemes}
    lists: dict[str, list[dict]] = {}
    for row in returns_rows(schemes):
        lists.setdefault(list_of[row["scheme_code"]], []).append(row)
    lists = {key: adjust_returns_for_splits(rows) for key, rows in lists.items()}

    history = {}
    start = years_before(as_of, HISTORY_YEARS)
    for house in {b.fund_house for b in BENCHMARKS}:
        codes = {b.scheme_code for b in BENCHMARKS if b.fund_house == house}
        history.update(month_end_history(house, codes, start, as_of))
        print(f"  history from fund house {house}: {len(codes)} ETFs")

    OUT.write_text(json.dumps({
        "source": "AMFI NAVs (portal.amfiindia.com)",
        "as_of": as_of.isoformat(),
        "fetched_on": date.today().isoformat(),
        "lists": lists,
        "history": {str(code): adjust_history_for_splits(points) for code, points in history.items()},
    }, indent=1) + "\n")
    print(f"Saved {OUT}: " + ", ".join(f"{k} {len(v)}" for k, v in lists.items()))


if __name__ == "__main__":
    main()
