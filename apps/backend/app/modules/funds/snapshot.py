"""Shared steps for the scripts that build the AMFI snapshots the app ships with."""

from datetime import date

from app.modules.funds.amfi import SchemeNav, fetch_history, fetch_navs_around

PERIODS = {"one_year": 1, "three_year": 3, "five_year": 5}


def years_before(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:  # 29 February
        return day.replace(year=day.year - years, day=28)


def returns_rows(schemes: list[SchemeNav]) -> list[dict]:
    """Each scheme's latest NAV and compound annual return over 1, 3 and 5 years;
    a period is null when the scheme is younger than it. One download per period."""
    as_of = max(s.on for s in schemes)
    codes = {s.scheme_code for s in schemes}
    past = {}
    for key, years in PERIODS.items():
        past[key] = fetch_navs_around(years_before(as_of, years), codes)
        print(f"  {years}y ago: {len(past[key])} NAVs")

    rows = []
    for s in schemes:
        row = {"scheme_code": s.scheme_code, "name": s.name, "nav": s.nav}
        for key, years in PERIODS.items():
            then = past[key].get(s.scheme_code)
            span = (s.on - then.on).days / 365.25 if then else 0
            row[key] = round(((s.nav / then.nav) ** (1 / span) - 1) * 100, 2) if then and span > 0.9 * years else None
        rows.append(row)
    return rows


def month_end_history(fund_house: int, codes: set[int], start: date, end: date) -> dict[int, list[list]]:
    """Month-end NAVs (plus the latest day) per scheme, fetched a year at a time."""
    points = []
    for year in range(start.year, end.year + 1):
        points += fetch_history(fund_house, max(start, date(year, 1, 1)), min(end, date(year, 12, 31)), codes)
    series: dict[int, dict[str, list]] = {code: {} for code in codes}
    for p in sorted(points, key=lambda p: p.on):
        series[p.scheme_code][p.on.strftime("%Y-%m")] = [p.on.isoformat(), p.nav]
    return {code: list(months.values()) for code, months in series.items()}


# ETFs split their units (1:10, 1:100…) to keep the price affordable; the NAV per
# unit then drops by that factor overnight, which raw NAVs read as a crash.
SPLIT_FACTORS = (2, 4, 5, 10, 20, 25, 50, 100, 1000)


def _nearest_factor(ratio: float) -> int | None:
    factor = min(SPLIT_FACTORS, key=lambda f: abs(f - ratio) / f)
    return factor if abs(factor - ratio) / factor < 0.15 else None


def adjust_history_for_splits(points: list[list]) -> list[list]:
    """Divides NAVs before a unit split by its factor, so the series is continuous.
    A split shows as a one-step fall of 60%+ that is close to a split ratio."""
    adjusted = [list(p) for p in points]
    for i in range(len(adjusted) - 1, 0, -1):
        before, after = adjusted[i - 1][1], adjusted[i][1]
        if after / before < 0.4 and (factor := _nearest_factor(before / after)):
            for p in adjusted[:i]:
                p[1] = round(p[1] / factor, 4)
    return adjusted


# A split shrinks the NAV ratio by its factor: even 1:2 turns into -29% a year over
# 1 year and far worse over 3–5 years. Real ETF returns below these are implausible,
# so they're left out when finding what the group actually returned.
_PLAUSIBLE_FLOOR = {"one_year": -60.0, "three_year": -25.0, "five_year": -20.0}


def adjust_returns_for_splits(rows: list[dict]) -> list[dict]:
    """ETFs tracking the same thing return almost exactly the same. A return far
    from its group's typical return (the median of plausible values) is corrected
    by the split factor that brings it back in line, or dropped (null) if none does."""
    from statistics import median

    for key, years in PERIODS.items():
        values = [r[key] for r in rows if r[key] is not None and r[key] > _PLAUSIBLE_FLOOR[key]]
        if not values:
            for row in rows:
                row[key] = None
            continue
        mid = median(values)
        for row in rows:
            value = row[key]
            if value is None or abs(value - mid) <= 10:
                continue
            ratio = (1 + value / 100) ** years
            fixed = None
            for factor in SPLIT_FACTORS:
                candidate = ((ratio * factor) ** (1 / years) - 1) * 100
                if abs(candidate - mid) <= 3:
                    fixed = round(candidate, 2)
                    break
            row[key] = fixed
    return rows
