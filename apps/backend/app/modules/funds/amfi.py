"""
AMFI (Association of Mutual Funds in India) NAV data: the official, public
source every Indian fund platform uses. Two plain-text endpoints, no key:

- NAVAll.txt: the latest NAV of every scheme, published nightly.
- DownloadNAVHistoryReport: daily NAVs for one fund house over a date range.

Lines are `;`-separated; headings and blank lines between them are skipped.
"""

import time
from dataclasses import dataclass
from datetime import date, datetime

import httpx

LATEST_URL = "https://portal.amfiindia.com/spages/NAVAll.txt"
HISTORY_URL = "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"
_HEADERS = {"User-Agent": "MoneyMitra/1.0 (+https://github.com/Srija-Chittaluru/MoneyMitra)"}


@dataclass(frozen=True)
class NavPoint:
    scheme_code: int
    nav: float
    on: date


def _parse_date(text: str) -> date:
    return datetime.strptime(text.strip(), "%d-%b-%Y").date()


def _parse(text: str, code_col: int, nav_col: int, date_col: int, wanted: set[int]) -> list[NavPoint]:
    points = []
    for line in text.splitlines():
        parts = line.split(";")
        if len(parts) <= max(code_col, nav_col, date_col) or not parts[code_col].strip().isdigit():
            continue
        code = int(parts[code_col])
        if code not in wanted:
            continue
        try:
            points.append(NavPoint(code, float(parts[nav_col]), _parse_date(parts[date_col])))
        except ValueError:  # "N.A." NAVs on holidays or suspended schemes
            continue
    return points


def parse_latest(text: str, wanted: set[int]) -> list[NavPoint]:
    # Scheme Code;ISIN Growth;ISIN Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
    return _parse(text, 0, 6, 7, wanted)


def parse_history(text: str, wanted: set[int]) -> list[NavPoint]:
    # Scheme Code;NAV Name;Plan;Option;ISIN Growth;ISIN Reinvestment;Net Asset Value;Date
    return _parse(text, 0, 6, 7, wanted)


@dataclass(frozen=True)
class SchemeNav:
    scheme_code: int
    name: str
    category: str  # AMFI's heading, e.g. "Equity Scheme - Large Cap Fund"
    nav: float
    on: date


def parse_latest_schemes(text: str, direct_growth_only: bool = True) -> list[SchemeNav]:
    """Every Direct-plan Growth-option scheme in NAVAll.txt, with its category
    heading. ETFs have no plan or option, so for them pass `direct_growth_only=False`
    (payout/IDCW variants are still dropped)."""
    schemes, category = [], ""
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("Open Ended Schemes"):
            category = stripped[stripped.find("(") + 1 : stripped.rfind(")")].strip()
            continue
        parts = stripped.split(";")
        if len(parts) < 8 or not parts[0].isdigit():
            continue
        plan, option = parts[4].lower(), parts[5].lower()
        if "idcw" in option or "idcw" in parts[3].lower():
            continue
        if direct_growth_only and ("direct" not in plan or "growth" not in option):
            continue
        try:
            schemes.append(SchemeNav(int(parts[0]), parts[3].strip(), category, float(parts[6]), _parse_date(parts[7])))
        except ValueError:
            continue
    return schemes


def fetch_latest_schemes(timeout: float = 30.0, direct_growth_only: bool = True) -> list[SchemeNav]:
    response = httpx.get(LATEST_URL, headers=_HEADERS, timeout=timeout, follow_redirects=True)
    response.raise_for_status()
    return parse_latest_schemes(response.text, direct_growth_only)


def fetch_navs_around(day: date, wanted: set[int], days_before: int = 7, timeout: float = 120.0) -> dict[int, NavPoint]:
    """Each wanted scheme's last NAV on or before `day` (looking back a week for
    holidays), from one all-fund-house history download."""
    from datetime import timedelta

    params = {"tp": 1, "frmdt": (day - timedelta(days=days_before)).strftime("%d-%b-%Y"), "todt": day.strftime("%d-%b-%Y")}
    response = httpx.get(HISTORY_URL, params=params, headers=_HEADERS, timeout=timeout, follow_redirects=True)
    response.raise_for_status()
    latest: dict[int, NavPoint] = {}
    for point in parse_history(response.text, wanted):
        if point.on <= day and (point.scheme_code not in latest or point.on > latest[point.scheme_code].on):
            latest[point.scheme_code] = point
    return latest


def fetch_latest(wanted: set[int], timeout: float = 10.0) -> list[NavPoint]:
    response = httpx.get(LATEST_URL, headers=_HEADERS, timeout=timeout, follow_redirects=True)
    response.raise_for_status()
    return parse_latest(response.text, wanted)


def fetch_history(fund_house: int, start: date, end: date, wanted: set[int], timeout: float = 120.0) -> list[NavPoint]:
    params = {"mf": fund_house, "tp": 1, "frmdt": start.strftime("%d-%b-%Y"), "todt": end.strftime("%d-%b-%Y")}
    response = httpx.get(HISTORY_URL, params=params, headers=_HEADERS, timeout=timeout, follow_redirects=True)
    response.raise_for_status()
    return parse_history(response.text, wanted)


class LatestNavCache:
    """Latest NAVs from AMFI, fetched at most every `ttl` seconds. A failed
    fetch is remembered for a few minutes so a slow AMFI never slows every page."""

    def __init__(self, ttl: int = 6 * 60 * 60, retry_after: int = 5 * 60) -> None:
        self.ttl, self.retry_after = ttl, retry_after
        self._points: dict[int, NavPoint] = {}
        self._fetched_at = 0.0
        self._failed_at = 0.0

    def get(self, wanted: set[int]) -> dict[int, NavPoint]:
        now = time.monotonic()
        fresh = self._points and now - self._fetched_at < self.ttl
        recently_failed = now - self._failed_at < self.retry_after
        if not fresh and not recently_failed:
            try:
                self._points = {p.scheme_code: p for p in fetch_latest(wanted)}
                self._fetched_at = now
            except (httpx.HTTPError, ValueError):
                self._failed_at = now
        return {code: point for code, point in self._points.items() if code in wanted}

    def clear(self) -> None:
        self._points, self._fetched_at, self._failed_at = {}, 0.0, 0.0


latest_navs = LatestNavCache()
