"""
Static reference content for the Resources page: curated government
deadlines and a deduction-limits lookup table.

Manually maintained, not live-fetched: the Income Tax Department's RSS
feeds (press-release-rss-feed, circular-rss-feed) are blocked at the
network edge (Akamai WAF returns "Access Denied" even with a browser
user-agent) and PIB's own RssMain.aspx feed returns an empty channel
with no items. Rather than wire up something that silently doesn't work
in production, this list is verified by hand and should be updated by
hand as dates pass or new changes are announced.
"""

from dataclasses import dataclass
from datetime import date
from enum import Enum

from app.modules.tax.instruments import DeductionSection, SECTION_LABELS


class AlertCategory(str, Enum):
    ITR_FILING = "itr_filing"
    ADVANCE_TAX = "advance_tax"
    INVESTMENT_DEADLINE = "investment_deadline"


@dataclass(frozen=True)
class GovernmentAlert:
    title: str
    date: date  # the due/effective date the alert is about
    description: str
    category: AlertCategory
    source: str | None = None


GOVERNMENT_ALERTS: list[GovernmentAlert] = [
    GovernmentAlert(
        title="ITR filing deadline extended for tax-audit cases (AY 2026-27)",
        date=date(2026, 11, 21),
        description=(
            "The deadline for taxpayers whose accounts are subject to audit was extended from "
            "31 October 2026 to 21 November 2026. The tax audit report deadline moved from "
            "30 September 2026 to 21 October 2026."
        ),
        category=AlertCategory.ITR_FILING,
        source="CBDT Circular No. 07/2026, dated 28 September 2026",
    ),
    GovernmentAlert(
        title="ITR filing deadline — transfer pricing cases (AY 2026-27)",
        date=date(2026, 11, 30),
        description="Due date for taxpayers required to furnish a transfer pricing report.",
        category=AlertCategory.ITR_FILING,
    ),
    GovernmentAlert(
        title="Advance tax — 3rd instalment due",
        date=date(2026, 12, 15),
        description=(
            "75% of your estimated annual tax liability for FY 2026-27 should be paid by this "
            "date (cumulative, less instalments already paid)."
        ),
        category=AlertCategory.ADVANCE_TAX,
    ),
    GovernmentAlert(
        title="Advance tax — 4th and final instalment due",
        date=date(2027, 3, 15),
        description="100% of your estimated annual tax liability for FY 2026-27 should be paid by this date.",
        category=AlertCategory.ADVANCE_TAX,
    ),
    GovernmentAlert(
        title="Last date to complete FY 2026-27 tax-saving investments",
        date=date(2027, 3, 31),
        description=(
            "Investments under 80C, 80D, 80CCD(1B), and home loan payments must be made by this "
            "date to count for FY 2026-27 — see Tax Planning for how much headroom is left."
        ),
        category=AlertCategory.INVESTMENT_DEADLINE,
    ),
]


@dataclass(frozen=True)
class DeductionLimit:
    section: DeductionSection
    label: str
    limit_general: int
    limit_senior: int | None = None  # only 80D differs by age today


DEDUCTION_LIMITS: list[DeductionLimit] = [
    DeductionLimit(DeductionSection.SECTION_80C, SECTION_LABELS[DeductionSection.SECTION_80C], 150_000),
    DeductionLimit(
        DeductionSection.SECTION_80D,
        SECTION_LABELS[DeductionSection.SECTION_80D],
        limit_general=25_000,
        limit_senior=50_000,
    ),
    DeductionLimit(DeductionSection.SECTION_24B, SECTION_LABELS[DeductionSection.SECTION_24B], 200_000),
    DeductionLimit(
        DeductionSection.SECTION_80CCD_1B, SECTION_LABELS[DeductionSection.SECTION_80CCD_1B], 50_000
    ),
]
