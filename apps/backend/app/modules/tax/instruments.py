"""
Reference data: which instruments/documents qualify under each old-regime
deduction section. Informational only — this is not personalized investment
advice (no specific fund/product is recommended), just what the section
allows.
"""

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
