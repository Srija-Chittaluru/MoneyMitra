"""
Downloads NAV history for the three cap index funds from AMFI and saves a
month-end snapshot the app ships with. Run from apps/backend:

    python -m scripts.fetch_amfi_history

The app adds the latest NAV from AMFI on top of this snapshot at run time, so
it only needs re-running to extend the history (e.g. once a year).
"""

import json
from datetime import date
from pathlib import Path

from app.modules.funds.amfi import fetch_history
from app.modules.funds.catalogue import FUND_HOUSE, SCHEME_CODES

START = date(2019, 9, 1)  # the funds launched in Sep–Dec 2019
OUT = Path(__file__).resolve().parents[1] / "app/modules/funds/data/amfi_nav_history.json"


def main() -> None:
    today = date.today()
    points = []
    for year in range(START.year, today.year + 1):
        start = max(START, date(year, 1, 1))
        end = min(today, date(year, 12, 31))
        chunk = fetch_history(FUND_HOUSE, start, end, SCHEME_CODES)
        print(f"{year}: {len(chunk)} NAVs")
        points += chunk

    # Keep the last NAV of each month, plus the very latest day.
    series: dict[int, dict[str, tuple[str, float]]] = {code: {} for code in SCHEME_CODES}
    for p in sorted(points, key=lambda p: p.on):
        series[p.scheme_code][p.on.strftime("%Y-%m")] = (p.on.isoformat(), p.nav)

    snapshot = {
        "source": "AMFI NAV history (portal.amfiindia.com)",
        "fetched_on": today.isoformat(),
        "schemes": {str(code): [list(v) for v in months.values()] for code, months in series.items()},
    }
    OUT.write_text(json.dumps(snapshot, indent=1) + "\n")
    print(f"Saved {OUT}")


if __name__ == "__main__":
    main()
