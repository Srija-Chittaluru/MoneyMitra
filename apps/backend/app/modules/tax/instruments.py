"""
Reference data: which instruments/documents qualify under each old-regime
deduction section. Informational only — this is not personalized investment
advice (no specific fund/product is recommended), just what the section
allows.
"""

from dataclasses import dataclass
from enum import Enum


class DeductionSection(str, Enum):
    SECTION_80C = "80C"
    SECTION_80D = "80D"
    HRA = "HRA"
    SECTION_24B = "24B"
    SECTION_80CCD_1B = "80CCD(1B)"


SECTION_LABELS: dict[DeductionSection, str] = {
    DeductionSection.SECTION_80C: "Section 80C",
    DeductionSection.SECTION_80D: "Section 80D (health insurance)",
    DeductionSection.HRA: "HRA exemption",
    DeductionSection.SECTION_24B: "Section 24(b) (home loan interest)",
    DeductionSection.SECTION_80CCD_1B: "Section 80CCD(1B) (NPS)",
}

QUALIFYING_INSTRUMENTS: dict[DeductionSection, list[str]] = {
    DeductionSection.SECTION_80C: [
        "EPF/VPF contribution",
        "PPF",
        "ELSS mutual funds",
        "Life insurance premium",
        "5-year tax-saving FD",
        "NSC",
        "Sukanya Samriddhi",
        "Home loan principal repayment",
        "Children's tuition fees",
    ],
    DeductionSection.SECTION_80D: [
        "Health insurance premium (self/family)",
        "Health insurance premium (parents — separate limit, not modeled here)",
    ],
    DeductionSection.HRA: [
        "Rent receipts",
        "Rent agreement",
        "Landlord PAN (if annual rent exceeds ₹1,00,000)",
    ],
    DeductionSection.SECTION_24B: [
        "Home loan interest certificate from the lender",
    ],
    DeductionSection.SECTION_80CCD_1B: [
        "NPS Tier 1 contribution",
    ],
}


@dataclass(frozen=True)
class InstrumentOption:
    name: str
    description: str
    lock_in: str
    type: str  # short classification: how to think about this option
    why: str  # what kind of person/situation this option fits — not a personal recommendation
    link: str | None = None  # official source to learn more; omitted where none exists


# Richer per-instrument detail for Tax Planning. Kept separate from
# QUALIFYING_INSTRUMENTS above (which stays untouched for Tax Comparison's
# deduction checklist) so this doesn't risk that already-shipped feature.
#
# `link` targets are verified official/regulator sources (EPFO, National
# Savings Institute, SEBI investor education, IRDAI, PFRDA) — not guessed.
# Left out entirely for instruments with no dedicated official page (e.g.
# bank FDs, or categories that are just an existing expense like EMI
# principal) rather than pointing somewhere unverified.
INSTRUMENT_OPTIONS: dict[DeductionSection, list[InstrumentOption]] = {
    DeductionSection.SECTION_80C: [
        InstrumentOption(
            "EPF / VPF",
            "Retirement savings deducted from salary — you can voluntarily contribute more "
            "(VPF) on top of the mandatory amount.",
            "Until retirement or resignation",
            "Government-backed, fixed return",
            "Already happening automatically if you're salaried — VPF just lets you add more "
            "into the same safe account without opening anything new.",
            link="https://www.epfo.gov.in/",
        ),
        InstrumentOption(
            "PPF",
            "A long-term savings account opened at a bank or post office.",
            "15 years (partial withdrawal allowed after year 7)",
            "Government-backed, fixed return",
            "Good if you want a guaranteed, government-backed return and can leave the money "
            "untouched for the long term — one of the safest options on this list.",
            link="https://www.nsiindia.gov.in/InternalPage.aspx?Id_Pk=55",
        ),
        InstrumentOption(
            "ELSS mutual funds",
            "Equity mutual funds with a tax-saving lock-in — the shortest lock-in of any 80C "
            "option, but returns depend on the market.",
            "3 years",
            "Market-linked, not guaranteed",
            "Good if you're comfortable with market ups and downs in exchange for the shortest "
            "lock-in of any 80C option and potentially higher long-term returns.",
            link="https://investor.sebi.gov.in/elss.html",
        ),
        InstrumentOption(
            "5-year tax-saving FD",
            "A fixed deposit at a bank with a mandatory 5-year lock-in.",
            "5 years",
            "Bank deposit, fixed return",
            "Good if you want a fixed, predictable return through your existing bank with no "
            "market risk, and don't mind the 5-year lock-in.",
        ),
        InstrumentOption(
            "NSC",
            "A government savings certificate, available at post offices.",
            "5 years",
            "Government-backed, fixed return",
            "Good if you want a safe, government-backed, fixed return and are fine locking the "
            "money away for 5 years.",
            link="https://www.nsiindia.gov.in/InternalPage.aspx?Id_Pk=27",
        ),
        InstrumentOption(
            "Life insurance premium",
            "Premiums paid on a life insurance policy (term or traditional).",
            "Length of the policy",
            "Insurance, not a pure investment",
            "Only makes sense if you actually need the insurance cover — the tax deduction is a "
            "side benefit, not a reason on its own to buy a policy.",
            link="https://irdai.gov.in/",
        ),
        InstrumentOption(
            "Sukanya Samriddhi",
            "A government scheme for a girl child, opened before she turns 10.",
            "Until she turns 21 (partial withdrawal at 18)",
            "Government-backed, fixed return",
            "Only relevant if you have a daughter under 10 — in exchange, it carries one of the "
            "highest guaranteed rates among government savings schemes.",
            link="https://www.nsiindia.gov.in/InternalPage.aspx?Id_Pk=177",
        ),
        InstrumentOption(
            "Home loan principal repayment",
            "The principal portion of EMIs, if you already have a home loan.",
            "N/A — only applies if you have a home loan",
            "Existing expense, not a new investment",
            "Nothing extra to invest here — if you already have a home loan, the principal "
            "portion of your EMI counts automatically.",
        ),
        InstrumentOption(
            "Children's tuition fees",
            "Tuition fees for up to two children's full-time education in India.",
            "N/A — only applies if you have school-age children",
            "Existing expense, not a new investment",
            "Nothing extra to invest here — if you already pay tuition for up to two children, "
            "it counts automatically. Just remember to claim it.",
        ),
    ],
    DeductionSection.SECTION_80D: [
        InstrumentOption(
            "Health insurance premium (self/family)",
            "Premium for a health policy covering yourself, spouse, and children.",
            "Length of the policy",
            "Insurance",
            "Worth having regardless of tax — the deduction is a bonus on top of real medical "
            "protection for you and your family.",
            link="https://irdai.gov.in/",
        ),
        InstrumentOption(
            "Health insurance premium (parents)",
            "A separate limit for your parents' health insurance — higher if they're senior "
            "citizens. Not modeled separately in this app's numbers yet.",
            "Length of the policy",
            "Insurance",
            "A separate limit from your own cover — relevant only if you're paying for your "
            "parents' health insurance premiums.",
            link="https://irdai.gov.in/",
        ),
        InstrumentOption(
            "Preventive health check-up",
            "A small sub-limit inside the overall 80D cap for check-up expenses — doesn't need "
            "a policy.",
            "N/A",
            "Existing expense, not a new investment",
            "A small bonus inside the same limit if you get an annual check-up — no policy "
            "required, and easy to use even late in the year.",
        ),
    ],
    DeductionSection.SECTION_24B: [
        InstrumentOption(
            "Home loan interest",
            "Interest paid on a home loan, for a self-occupied or rented-out property.",
            "Ongoing, for the life of the loan",
            "Existing expense, not a new investment",
            "Nothing extra to invest here — if you have a home loan, this is simply the interest "
            "portion of your EMI.",
        ),
    ],
    DeductionSection.SECTION_80CCD_1B: [
        InstrumentOption(
            "NPS Tier 1",
            "A retirement account with a choice of equity/debt mix; this ₹50,000 limit is over "
            "and above the 80C cap.",
            "Until retirement (60), with partial withdrawal rules",
            "Market-linked, government-regulated",
            "Good if you want to push retirement savings beyond the 80C cap — this limit is over "
            "and above it — but the money stays locked until retirement.",
            link="https://www.pfrda.org.in/schemes/national-pension-system/about-nps",
        ),
    ],
}
