from datetime import date

from app.modules.tax.rules.types import AgeCategory


def financial_year_end_date(tax_year: str) -> date:
    """'2025-26' -> the FY runs 2025-04-01 to 2026-03-31."""
    start_year = int(tax_year.split("-")[0])
    return date(start_year + 1, 3, 31)


def resolve_age_category(date_of_birth: date | None, tax_year: str) -> AgeCategory:
    """Age category is determined by completed age as of the last day of the
    financial year (standard Income Tax convention). Defaults to GENERAL
    when no date of birth is available."""
    if date_of_birth is None:
        return AgeCategory.GENERAL

    as_of = financial_year_end_date(tax_year)
    age = as_of.year - date_of_birth.year - (
        (as_of.month, as_of.day) < (date_of_birth.month, date_of_birth.day)
    )

    if age >= 80:
        return AgeCategory.SUPER_SENIOR
    if age >= 60:
        return AgeCategory.SENIOR
    return AgeCategory.GENERAL
