"""
Recurring deposit rates, entered by hand from each provider's published rates.

There is no official feed of bank deposit rates (RBI publishes none per bank),
and bank websites render their tables in the browser, so these are checked and
updated manually: change the figures, `effective_date` and `checked_on` here
when a provider revises its rates. Only rates confirmed from the provider's own
website (or, for ICICI, two agreeing reports) are listed.

Banks pay the same rate on an RD as on an FD of the same tenure, so where a
bank publishes no separate RD table its term-deposit table is used. A tenure a
provider doesn't offer as an RD is left out (IDFC FIRST has no 5-year RD).
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal

Tenure = Literal["1y", "2y", "3y", "5y"]

TENURES: dict[Tenure, tuple[str, int]] = {
    "1y": ("1 year", 12),
    "2y": ("2 years", 24),
    "3y": ("3 years", 36),
    "5y": ("5 years", 60),
}


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    kind: Literal["bank", "post_office"]
    # % a year by tenure; a tenure the provider doesn't offer is absent.
    general: dict[Tenure, float]
    senior: dict[Tenure, float]
    min_monthly: int | None  # None when the bank doesn't publish one we've verified
    effective_date: date
    source: str
    source_url: str


CHECKED_ON = date(2026, 10, 10)

PROVIDERS: tuple[Provider, ...] = (
    Provider(
        id="sbi",
        name="State Bank of India",
        kind="bank",
        general={"1y": 6.25, "2y": 6.40, "3y": 6.30, "5y": 6.05},
        senior={"1y": 6.75, "2y": 6.90, "3y": 6.80, "5y": 6.55},
        min_monthly=100,
        effective_date=date(2025, 12, 15),
        source="SBI retail term deposit rates",
        source_url="https://sbi.bank.in/web/interest-rates/deposit-rates/retail-domestic-term-deposits",
    ),
    Provider(
        id="icici",
        name="ICICI Bank",
        kind="bank",
        general={"1y": 6.25, "2y": 6.30, "3y": 6.45, "5y": 6.50},
        senior={"1y": 6.75, "2y": 6.80, "3y": 6.95, "5y": 7.10},
        min_monthly=500,
        effective_date=date(2025, 12, 29),
        source="ICICI Bank RD rates, as reported by Upstox and Business Today",
        source_url="https://upstox.com/news/personal-finance/investing/recurring-deposit-interest-rate-in-july-2026-sbi-post-office-hdfc-icici-axis-kotak-compared/article-196456/",
    ),
    Provider(
        id="hdfc",
        name="HDFC Bank",
        kind="bank",
        general={"1y": 6.25, "2y": 6.45, "3y": 6.45, "5y": 6.40},
        senior={"1y": 6.75, "2y": 6.95, "3y": 6.95, "5y": 6.90},
        min_monthly=None,
        effective_date=date(2026, 8, 19),
        source="HDFC Bank term deposit rates (RDs earn the same)",
        source_url="https://www.hdfc.bank.in/fixed-deposit/fd-interest-rate",
    ),
    Provider(
        id="axis",
        name="Axis Bank",
        kind="bank",
        general={"1y": 6.25, "2y": 6.50, "3y": 6.50, "5y": 6.50},
        senior={"1y": 6.75, "2y": 7.00, "3y": 7.00, "5y": 7.25},
        min_monthly=None,
        effective_date=date(2025, 12, 22),
        source="Axis Bank RD rates",
        source_url="https://www.axis.bank.in/deposits/recurring-deposits/interest-rates",
    ),
    Provider(
        id="kotak",
        name="Kotak Mahindra Bank",
        kind="bank",
        general={"1y": 6.35, "2y": 6.65, "3y": 6.40, "5y": 6.25},
        senior={"1y": 6.85, "2y": 7.15, "3y": 6.90, "5y": 6.75},
        min_monthly=None,
        effective_date=date(2026, 9, 23),
        source="Kotak Mahindra Bank RD rates",
        source_url="https://www.kotak.bank.in/en/rates/interest-rates.html",
    ),
    Provider(
        id="pnb",
        name="Punjab National Bank",
        kind="bank",
        general={"1y": 6.25, "2y": 6.30, "3y": 6.30, "5y": 6.35},
        senior={"1y": 6.75, "2y": 6.80, "3y": 6.80, "5y": 6.85},
        min_monthly=None,
        effective_date=date(2026, 6, 1),
        source="PNB term deposit rates (RDs earn the same)",
        source_url="https://pnb.bank.in/Interest-Rates-Deposit.html",
    ),
    Provider(
        id="bob",
        name="Bank of Baroda",
        kind="bank",
        general={"1y": 6.25, "2y": 6.25, "3y": 6.25, "5y": 6.30},
        senior={"1y": 6.75, "2y": 6.75, "3y": 6.75, "5y": 6.90},
        min_monthly=None,
        effective_date=date(2026, 6, 12),
        source="Bank of Baroda term deposit rates (RDs earn the same)",
        source_url="https://bankofbaroda.bank.in/interest-rate-and-service-charges/deposits-interest-rates/fixed-deposits-callable-and-non-callable-upto-ten-crores",
    ),
    Provider(
        id="canara",
        name="Canara Bank",
        kind="bank",
        general={"1y": 6.25, "2y": 6.25, "3y": 6.25, "5y": 6.25},
        senior={"1y": 6.75, "2y": 6.75, "3y": 6.75, "5y": 6.75},
        min_monthly=None,
        effective_date=date(2026, 3, 17),
        source="Canara Bank term deposit rates (RDs earn the same)",
        source_url="https://www.canarabank.bank.in/term-deposits-rate-of-interest-p.a.",
    ),
    Provider(
        id="union",
        name="Union Bank of India",
        kind="bank",
        general={"1y": 6.20, "2y": 6.15, "3y": 6.10, "5y": 6.00},
        # The bank prints general rates and a flat +0.50% for senior citizens.
        senior={"1y": 6.70, "2y": 6.65, "3y": 6.60, "5y": 6.50},
        min_monthly=None,
        effective_date=date(2026, 8, 4),
        source="Union Bank of India deposit rates (seniors +0.50%)",
        source_url="https://www.unionbankofindia.bank.in/en/details/rate-of-interest",
    ),
    Provider(
        id="idfc_first",
        name="IDFC FIRST Bank",
        kind="bank",
        general={"1y": 6.50, "2y": 7.10, "3y": 7.10},
        senior={"1y": 6.75, "2y": 7.35, "3y": 7.35},
        min_monthly=None,
        effective_date=date(2026, 9, 1),
        source="IDFC FIRST Bank RD rates",
        source_url="https://www.idfcfirst.bank.in/personal-banking/deposits/recurring-deposit/rd-interest-rates",
    ),
    Provider(
        id="indusind",
        name="IndusInd Bank",
        kind="bank",
        general={"1y": 6.75, "2y": 7.00, "3y": 7.00, "5y": 6.65},
        senior={"1y": 7.25, "2y": 7.75, "3y": 7.75, "5y": 7.15},
        min_monthly=None,
        effective_date=date(2026, 6, 1),
        source="IndusInd Bank RD rates",
        source_url="https://www.indusind.bank.in/in/en/personal/rates.html",
    ),
    Provider(
        id="indian_bank",
        name="Indian Bank",
        kind="bank",
        general={"1y": 6.10, "2y": 6.15, "3y": 6.05, "5y": 6.00},
        # The bank prints general rates and +0.50% for senior citizens, RDs included.
        senior={"1y": 6.60, "2y": 6.65, "3y": 6.55, "5y": 6.50},
        min_monthly=None,
        effective_date=date(2026, 8, 4),
        source="Indian Bank term deposit rates (seniors +0.50%)",
        source_url="https://indianbank.bank.in/departments/deposit-rates/",
    ),
    Provider(
        id="post_office",
        name="Post Office (5-year RD)",
        kind="post_office",
        general={"5y": 6.70},
        senior={"5y": 6.70},
        min_monthly=100,
        effective_date=date(2026, 7, 1),
        source="Government small savings rate, Jul–Sep 2026 quarter",
        source_url="https://www.businesstoday.in/personal-finance/story/recurring-deposits-interest-rates-2026-sbi-icici-bank-pnb-post-office-rates-compared-550204-2026-08-20",
    ),
)
