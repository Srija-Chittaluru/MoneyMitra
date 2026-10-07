"""
Financial-year date math for tax planning.

Deliberately independent of app/modules/itr/rules.py's ItrYearRules: that
registry is keyed to the year currently being *filed* (FY 2025-26, for
AY 2026-27), not the ongoing year someone should be planning investments
for. This module only needs the calendar boundary (April 1 – March 31),
not any ITR-filing-specific data.
"""

from datetime import date


def current_financial_year(today: date) -> tuple[str, date, date]:
    """The Indian financial year containing `today`: ("2026-27", start, end)."""
    if today.month >= 4:
        start_year = today.year
    else:
        start_year = today.year - 1
    start = date(start_year, 4, 1)
    end = date(start_year + 1, 3, 31)
    label = f"{start_year}-{str(start_year + 1)[-2:]}"
    return label, start, end


def months_remaining(today: date, fy_end: date) -> int:
    """Whole months left to invest, counting the current month as still
    usable. Minimum 1 (there's always at least "right now")."""
    months = (fy_end.year - today.year) * 12 + (fy_end.month - today.month) + 1
    return max(1, months)


def financial_year_of_assessment_year(assessment_year: str) -> str:
    """Income is assessed the year after it is earned: AY "2026-27" is FY "2025-26"."""
    start_year = int(assessment_year.split("-")[0]) - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"
