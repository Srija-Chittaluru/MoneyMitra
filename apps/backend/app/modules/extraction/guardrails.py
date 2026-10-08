"""
Upload guardrails: recognise what a document actually is, and reject uploads
that are the wrong document type, another person's document, for another
year, or a file already uploaded — before anything is stored.

Recognition is by content (titles and markers each document carries), not by
file name.
"""

import re

DOCUMENT_NAMES = {
    "pan": "PAN card",
    "form16": "Form 16",
    "ais": "AIS",
    "form26as": "Form 26AS",
    "payslips": "Payslip",
    "capital_gains": "Capital gains / trading statement",
    "home_loan": "Home loan interest certificate",
    "tax_proofs": "Tax proofs",
    "bills": "Bills",
    "other": "Other documents",
}

# Categories whose content is checked and read into the return.
TAX_DOCUMENTS = {"pan", "form16", "ais", "form26as", "payslips", "capital_gains", "home_loan"}

# (pattern, weight). A strong marker alone identifies the document.
_MARKERS: dict[str, list[tuple[str, int]]] = {
    "form16": [(r"\bFORM\s*NO\.?\s*16\b", 5), (r"certificate under section 203", 4),
               (r"\bPART\s*B\b.*(annexure|salary paid)", 3), (r"\bForm\s*16\b", 1)],
    "form26as": [(r"\bForm\s*26\s*AS\b", 5), (r"Annual Tax Statement", 5), (r"Section\s*203AA", 3)],
    "ais": [(r"Annual Information Statement", 5), (r"Taxpayer Information Summary", 4), (r"\bSFT-\d{3}", 2)],
    "payslips": [(r"\bpay\s*-?\s*slip\b", 5), (r"\bsalary slip\b", 5), (r"\bnet pay\b", 2),
                 (r"\b(gross )?earnings\b", 1), (r"\bdeductions\b", 1)],
    "pan": [(r"Permanent Account Number Card", 5), (r"\bPAN CARD\b", 4), (r"Income Tax Department", 2),
            (r"Permanent Account Number", 2), (r"Father'?s Name", 2), (r"\bSignature\b", 1)],
    "capital_gains": [(r"Tax\s*P\s*&\s*L", 5), (r"capital gains? (?:&|and) trading statement", 5),
                      (r"capital gains? statement", 4), (r"contract note", 4), (r"realised (?:gains?|p&l)", 3),
                      (r"\bintraday\b", 1), (r"\bF&O\b", 1)],
    "home_loan": [(r"interest certificate", 4), (r"(housing|home) loan", 3), (r"provisional certificate", 3)],
}
_RECOGNISED_AT = 4


def classify(lines: list[str]) -> str | None:
    """The document type whose markers score highest, if any is recognised."""
    text = " ".join(lines[:400])
    scores = {}
    for kind, markers in _MARKERS.items():
        scores[kind] = sum(weight for pattern, weight in markers if re.search(pattern, text, re.IGNORECASE))
    # A PAN card mentions "Permanent Account Number", but so do Form 26AS and the AIS.
    for official in ("form26as", "ais", "form16", "capital_gains"):
        if scores[official] >= _RECOGNISED_AT:
            scores["pan"] = 0
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] >= _RECOGNISED_AT else None


class UploadRejected(Exception):
    """Raised with a message that tells the user what to do instead."""


def check_type(category: str, detected: str | None, readable: bool) -> None:
    expected = DOCUMENT_NAMES[category]
    if category in TAX_DOCUMENTS:
        if detected and detected != category:
            raise UploadRejected(
                f"This looks like {DOCUMENT_NAMES[detected]}, not {expected}. "
                f"Upload it under “{DOCUMENT_NAMES[detected]}”."
            )
        if detected is None and readable:
            raise UploadRejected(
                f"This doesn't look like a {expected}. Check you've chosen the right file — upload the "
                f"{expected} PDF (or a clear photo) for FY 2025-26."
            )
    elif detected in TAX_DOCUMENTS:
        raise UploadRejected(
            f"This looks like your {DOCUMENT_NAMES[detected]}. Upload it under “{DOCUMENT_NAMES[detected]}” "
            "so it can fill your return."
        )


def check_owner(category: str, document_pan: str | None, taxpayer_pan: str | None) -> None:
    if document_pan and taxpayer_pan and document_pan != taxpayer_pan:
        raise UploadRejected(
            f"This {DOCUMENT_NAMES[category]} is for PAN {document_pan}, but your return is for PAN {taxpayer_pan}. "
            "Upload your own document."
        )


def check_year(category: str, assessment_year: str | None, supported_years: list[str], lines: list[str]) -> None:
    if assessment_year and assessment_year not in supported_years:
        filing = ", ".join(supported_years)
        raise UploadRejected(
            f"This {DOCUMENT_NAMES[category]} is for AY {assessment_year}; MoneyMitra is filing AY {filing}. "
            "Upload the one for the right year."
        )
    if category == "payslips":
        text = " ".join(lines)
        m = re.search(r"pay\s*slip\s+for\s+(?:the\s+month\s+of\s+)?([a-z]{3})[a-z]*[\s,-]+(20\d{2})", text, re.IGNORECASE)
        if m:
            months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
            month = months.index(m.group(1).lower()) + 1 if m.group(1).lower() in months else None
            year = int(m.group(2))
            if month and not ((year == 2025 and month >= 4) or (year == 2026 and month <= 3)):
                raise UploadRejected(
                    f"This payslip is for {m.group(1).title()} {year}, outside FY 2025-26 (Apr 2025 – Mar 2026)."
                )


def pdf_active_content(data: bytes) -> list[str]:
    """Scripts, launch actions and embedded files have no place in a tax
    document and are how malicious PDFs attack viewers."""
    from io import BytesIO

    from pypdf import PdfReader

    found: set[str] = set()
    raw = data
    for marker, label in ((b"/JavaScript", "JavaScript"), (b"/Launch", "a launch action"),
                          (b"/EmbeddedFile", "an embedded file"), (b"/RichMedia", "embedded media")):
        if marker in raw:
            found.add(label)
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            return sorted(found)
        root = reader.trailer["/Root"]
        names = root.get("/Names")
        if names is not None:
            names = names.get_object()
            if "/JavaScript" in names:
                found.add("JavaScript")
            if "/EmbeddedFiles" in names:
                found.add("an embedded file")
        open_action = root.get("/OpenAction")
        if open_action is not None and not isinstance(open_action.get_object(), list):
            action = open_action.get_object()
            if action.get("/S") in ("/JavaScript", "/Launch"):
                found.add("JavaScript" if action.get("/S") == "/JavaScript" else "a launch action")
        for page in reader.pages:
            for annot in page.get("/Annots") or []:
                action = annot.get_object().get("/A")
                if action is not None and action.get_object().get("/S") in ("/JavaScript", "/Launch"):
                    found.add("JavaScript")
    except Exception:  # unreadable structure: content checks later decide
        pass
    return sorted(found)
