"""
Builds the fund lists (large, mid and small cap, ELSS) with each Direct-Growth
fund's 1, 3 and 5-year returns and the category average, from AMFI. Run from
apps/backend:

    python -m scripts.fetch_amfi_categories

Five downloads (latest NAVs plus one per period), about half a minute.
"""

import json
from pathlib import Path

from app.modules.funds.amfi import fetch_latest_schemes
from app.modules.funds.catalogue import fund_list_for
from app.modules.funds.snapshot import returns_rows

OUT = Path(__file__).resolve().parents[1] / "app/modules/funds/data/amfi_category_returns.json"


def main() -> None:
    schemes = [s for s in fetch_latest_schemes() if fund_list_for(s.category)]
    as_of = max(s.on for s in schemes)
    schemes = [s for s in schemes if (as_of - s.on).days <= 7]  # drop wound-up / stale schemes
    print(f"{len(schemes)} funds, NAVs as of {as_of}")

    category_of = {s.scheme_code: fund_list_for(s.category).id for s in schemes}
    lists: dict[str, list[dict]] = {}
    for row in returns_rows(schemes):
        lists.setdefault(category_of[row["scheme_code"]], []).append(row)

    OUT.write_text(json.dumps({
        "source": "AMFI NAVs (portal.amfiindia.com)",
        "as_of": as_of.isoformat(),
        "lists": lists,
    }, indent=1) + "\n")
    print(f"Saved {OUT}: " + ", ".join(f"{k} {len(v)}" for k, v in lists.items()))


if __name__ == "__main__":
    main()
