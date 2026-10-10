"""
Mutual funds by market cap: how large, mid and small caps have actually done
(from AMFI NAVs), and which one suits the user, by rules on their age, income
and time to invest. Category-level guidance only; no scheme is recommended.
"""

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from sqlalchemy.orm import Session

from app.modules.funds.amfi import latest_navs
from app.modules.funds.catalogue import CATEGORIES, FUND_LISTS, SCHEME_CODES, Cap, CapCategory
from app.modules.funds.schemas import (
    CapCategoryOut,
    CapMix,
    CapRecommendation,
    CapReturns,
    FundListOut,
    FundReturnsRow,
    MutualFundsOut,
    NavPointOut,
)
from app.modules.recommendations.context import load_financial_context
from app.modules.recommendations.stages import calculate_age
from app.modules.users.models import User

SNAPSHOT = Path(__file__).parent / "data" / "amfi_nav_history.json"
CATEGORY_SNAPSHOT = Path(__file__).parent / "data" / "amfi_category_returns.json"
RETIREMENT_AGE = 60

DISCLAIMER = (
    "Past returns don't guarantee future returns. Mutual fund investments are subject to market risks; read all "
    "scheme-related documents carefully. This is general guidance on fund categories, not advice to buy any scheme."
)

MIXES: dict[Cap, CapMix] = {
    "large": CapMix(large=80, mid=20, small=0),
    "mid": CapMix(large=50, mid=35, small=15),
    "small": CapMix(large=40, mid=30, small=30),
}


@lru_cache
def _snapshot() -> dict:
    return json.loads(SNAPSHOT.read_text())


@lru_cache
def _category_snapshot() -> dict:
    return json.loads(CATEGORY_SNAPSHOT.read_text())


def _average(rows: list[FundReturnsRow], key: str) -> float | None:
    values = [getattr(r, key) for r in rows if getattr(r, key) is not None]
    return round(sum(values) / len(values), 2) if values else None


def fund_lists() -> list[FundListOut]:
    snapshot = _category_snapshot()["lists"]
    out = []
    for fund_list in FUND_LISTS:
        rows = [FundReturnsRow(**row) for row in snapshot.get(fund_list.id, [])]
        # Best 3-year return first; funds too young for 3 years go last, by 1-year return.
        rows.sort(key=lambda r: (r.three_year is None, -(r.three_year or 0), -(r.one_year or 0)))
        out.append(FundListOut(
            id=fund_list.id, label=fund_list.label, note=fund_list.note,
            average=CapReturns(**{k: _average(rows, k) for k in ("one_year", "three_year", "five_year")}),
            funds=rows,
        ))
    return out


def _history(category: CapCategory) -> tuple[list[NavPointOut], bool]:
    """Month-end NAVs from the snapshot, with AMFI's latest NAV appended when it's newer."""
    points = [NavPointOut(date=date.fromisoformat(d), nav=nav) for d, nav in _snapshot()["schemes"][str(category.scheme_code)]]
    latest = latest_navs.get(SCHEME_CODES).get(category.scheme_code)
    if latest is None:
        return points, False
    if latest.on > points[-1].date:
        # Replace the snapshot's last point if it's from the same month: one point per month.
        if (latest.on.year, latest.on.month) == (points[-1].date.year, points[-1].date.month):
            points.pop()
        points.append(NavPointOut(date=latest.on, nav=latest.nav))
    return points, True


def _years_before(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:  # 29 February
        return day.replace(year=day.year - years, day=28)


def cagr(points: list[NavPointOut], years: int) -> float | None:
    """Compound annual growth from the NAV nearest `years` before the latest one."""
    latest = points[-1]
    target = _years_before(latest.date, years)
    if points[0].date > target and (points[0].date - target).days > 31:
        return None  # fund not old enough
    start = min(points, key=lambda p: abs((p.date - target).days))
    span = (latest.date - start.date).days / 365.25
    if span <= 0:
        return None
    return round(((latest.nav / start.nav) ** (1 / span) - 1) * 100, 1)


def worst_fall(points: list[NavPointOut]) -> float:
    peak, worst = points[0].nav, 0.0
    for p in points:
        peak = max(peak, p.nav)
        worst = min(worst, p.nav / peak - 1)
    return round(worst * 100, 1)


def recommend(age: int | None, income: int | None, income_source: str) -> CapRecommendation | None:
    """Score how much risk the user can take: time is the main factor, income
    the second. 3+ → small cap, 1–2 → mid cap, 0 or less → large cap."""
    if age is None:
        return None

    years = max(0, RETIREMENT_AGE - age)
    score = 2 if age < 30 else 1 if age < 45 else 0 if age < 50 else -2
    reasons = [f"At {age}, you have about {years} years before retirement" if years else
               f"At {age}, keeping what you've built safe matters more than chasing growth"]

    if income is not None:
        if income >= 1_500_000:
            score += 1
            reasons.append("Your income can absorb short-term market falls")
        elif income < 600_000:
            score -= 1
            reasons.append("On your income, steadier returns protect you from big drops")
        else:
            reasons.append("Your income supports regular monthly investing")

    cap: Cap = "small" if score >= 3 else "mid" if score >= 1 else "large"
    title = {
        "large": "Large cap suits you best",
        "mid": "Mid cap suits you best",
        "small": "Small cap suits you best",
    }[cap]
    reasons.append({
        "large": "Large caps fell the least in bad years while still beating FDs over time",
        "mid": "Mid caps have grown faster than large caps, and you have time to ride out their dips",
        "small": "You have the time to ride out small caps' deep falls for their higher long-term growth",
    }[cap])
    if age >= 50:
        reasons.append("Money you'll need within 3 years is safer in fixed deposits than in any equity fund")

    monthly_sip = None
    if income:
        monthly_sip = max(500, round(income / 12 * 0.10 / 500) * 500)

    basis = f"Based on your age and {income_source}" if income is not None else "Based on your age"
    return CapRecommendation(
        cap=cap, title=title, reasons=reasons, mix=MIXES[cap],
        monthly_sip=monthly_sip, years_to_invest=years, basis=basis,
    )


def _income(db: Session, user: User, today: date) -> tuple[int | None, str]:
    context = load_financial_context(db, user, today)
    if context is not None:
        label = "your ITR filing" if context.source == "itr_filing" else "your tax comparison"
        return context.annual_income, f"income from {label}"
    if user.expected_annual_income:
        return user.expected_annual_income, "your expected income"
    return None, ""


def get_mutual_funds(db: Session, user: User, today: date | None = None) -> MutualFundsOut:
    today = today or date.today()
    categories, live = [], False
    for category in CATEGORIES:
        history, is_live = _history(category)
        live = live or is_live
        latest = history[-1]
        categories.append(CapCategoryOut(
            cap=category.cap, label=category.label, benchmark=category.benchmark,
            scheme_code=category.scheme_code, scheme_name=category.scheme_name, risk=category.risk,
            what_it_is=category.what_it_is, suits=category.suits, min_years=category.min_years,
            latest_nav=latest.nav, latest_nav_date=latest.date,
            returns=CapReturns(one_year=cagr(history, 1), three_year=cagr(history, 3), five_year=cagr(history, 5)),
            worst_fall=worst_fall(history), history=history,
        ))

    age = calculate_age(user.date_of_birth, today) if user.date_of_birth else None
    income, income_source = _income(db, user, today)
    missing = [field for field, value in (("date_of_birth", age), ("income", income)) if value is None]

    return MutualFundsOut(
        categories=categories,
        fund_lists=fund_lists(),
        fund_lists_as_of=date.fromisoformat(_category_snapshot()["as_of"]),
        recommendation=recommend(age, income, income_source),
        missing=missing,
        as_of=max(c.latest_nav_date for c in categories),
        live=live,
        source="AMFI (Association of Mutual Funds in India)",
        disclaimer=DISCLAIMER,
    )
