"""
Rule-based extraction of ITR data from uploaded documents.

Each parser turns a document into an `Extraction`: scalar values keyed by
their dotted path in the ITR draft (e.g. `personal.pan`) plus rows for list
sections (employers, TDS entries). Parsers only report what they actually
find — anything missing is simply absent, so the ITR form leaves it empty.

Parsing is pattern-based, not AI: it reads text PDFs and AIS JSON. Scanned
documents and images have no text layer and are reported as unsupported.
Layouts handled: TRACES Form 16 (Part A, Part B and annexure), the e-filing
AIS (Part A, B1–B7 and the Taxpayer Information Summary), and payslips with
Current/YTD columns. Unusual layouts may fill only partly.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

PAN_RE = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b")
TAN_RE = re.compile(r"\b([A-Z]{4}[0-9]{5}[A-Z])\b")
DATE_RE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b")
AY_RE = re.compile(r"(?:Assessment\s+Year|\bAY)\s*:?\s*(20\d{2})\s*-\s*(\d{2})\b", re.IGNORECASE)
FY_RE = re.compile(r"Financial\s+Year\s*:?\s*(20\d{2})\s*-\s*(\d{2})\b", re.IGNORECASE)
COMPANY_RE = re.compile(
    r"^(.*?\b(?:Private\s+Limited|Pvt\.?\s*Ltd\.?|Limited|Ltd\.?|LLP)\b(?:\s*\([^)]*\))?)", re.IGNORECASE
)
_CURRENCY = r"(?:Rs\.?|INR|₹)"
# A number counts as money only if it has a currency prefix, Indian/Western
# digit grouping, or paise. This keeps counts, years and section numbers
# ("12", "192", "12BA") from being read as amounts.
_GROUPED = r"\d{1,3}(?:,\d{2})*,\d{3}(?:\.\d{1,2})?|\d+\.\d{1,2}"
AMOUNT_LINE_RE = re.compile(rf"^[-–]?\s*(?:{_CURRENCY}\s*[-–]?\s*(\d[\d,]*(?:\.\d{{1,2}})?)|({_GROUPED}))$")
INLINE_AMOUNT_RE = re.compile(
    rf"{_CURRENCY}\s*(\d[\d,]*(?:\.\d{{1,2}})?)|(?<![\w(.,/-])({_GROUPED})(?![\w)%/])"
)

STATE_CODES = {
    "andaman": "01", "andhra pradesh": "02", "arunachal": "03", "assam": "04", "bihar": "05",
    "chandigarh": "06", "dadra": "07", "daman": "08", "delhi": "09", "goa": "10", "gujarat": "11",
    "haryana": "12", "himachal": "13", "jammu": "14", "karnataka": "15", "kerala": "16",
    "lakshadweep": "17", "madhya pradesh": "18", "maharashtra": "19", "manipur": "20", "meghalaya": "21",
    "mizoram": "22", "nagaland": "23", "odisha": "24", "orissa": "24", "puducherry": "25",
    "pondicherry": "25", "punjab": "26", "rajasthan": "27", "sikkim": "28", "tamil nadu": "29",
    "tripura": "30", "uttar pradesh": "31", "west bengal": "32", "chhattisgarh": "33",
    "uttarakhand": "34", "jharkhand": "35", "telangana": "36", "ladakh": "37",
}

# AIS / 26AS TDS section -> ITR-1 schema `TDSSection` code.
TDS_SECTION_CODES = {
    "193": "193", "194": "194", "194A": "94A", "194B": "94B", "194D": "94D", "194DA": "4DA",
    "194EE": "4EE", "194H": "4H", "194I": "4-IB", "194IB": "4IB", "194J": "94J-B", "194K": "94K",
    "192A": "192A",
}

CAPITAL_GAINS_NOTE = (
    "Your AIS shows sales of shares, mutual funds or property. Capital gains must be reported in ITR-2, "
    "not ITR-1."
)


class UnreadableDocument(Exception):
    """The file has no extractable text (scanned/image) or is locked."""


@dataclass
class Extraction:
    assessment_year: str | None = None  # "2026-27" when the document states it
    fields: dict[str, object] = field(default_factory=dict)
    # list path -> rows; each row is a partial dict of that list's item model
    rows: dict[str, list[dict]] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    # Facts used to decide the ITR form and cross-check the return, not to
    # fill fields: e.g. {"capital_gains": {...}, "tds_26as": [...]}.
    facts: dict = field(default_factory=dict)

    def set(self, path: str, value) -> None:
        if value not in (None, "", 0, False):
            self.fields.setdefault(path, value)

    def add_row(self, list_path: str, row: dict) -> None:
        cleaned = {k: v for k, v in row.items() if v not in (None, "")}
        if cleaned:
            self.rows.setdefault(list_path, []).append(cleaned)

    def note(self, text: str) -> None:
        if text not in self.notes:
            self.notes.append(text)

    @property
    def is_empty(self) -> bool:
        return not self.fields and not any(self.rows.values())

    def to_json(self) -> dict:
        return {
            "assessment_year": self.assessment_year,
            "fields": self.fields,
            "rows": self.rows,
            "notes": self.notes,
            "facts": self.facts,
        }

    @classmethod
    def from_json(cls, data: dict) -> "Extraction":
        return cls(
            data.get("assessment_year"),
            data.get("fields", {}),
            data.get("rows", {}),
            data.get("notes", []),
            data.get("facts", {}),
        )


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


def pdf_lines(data: bytes, passwords: list[str]) -> list[str]:
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            # AIS PDFs are locked with PAN (lowercase) + date of birth (DDMMYYYY).
            if not any(reader.decrypt(pw) for pw in passwords if pw):
                raise UnreadableDocument(
                    "This PDF is password protected. Add your PAN and date of birth in ITR Filing, "
                    "then upload it again — or upload an unlocked copy."
                )
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except (PdfReadError, ValueError) as exc:
        raise UnreadableDocument("This PDF could not be read.") from exc
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    if not lines:
        raise UnreadableDocument("This PDF has no readable text (it may be a scanned image).")
    return lines


def to_int(raw: str) -> int:
    return round(float(raw.replace(",", "")))


def line_amount(line: str) -> int | None:
    """The amount when the whole line is one amount ("25,01,400.00",
    "Rs. 0", "-3,18,000.00"), else None. Returned as a positive number."""
    m = AMOUNT_LINE_RE.match(line.strip())
    if not m:
        return None
    return to_int(m.group(1) or m.group(2))


def inline_amounts(text: str) -> list[int]:
    return [to_int(m.group(1) or m.group(2)) for m in INLINE_AMOUNT_RE.finditer(text)]


_ITEM_MARKER = re.compile(r"^\(?[a-z]{1,3}\)$|^\d{1,2}\.$")


def amounts_after(lines: list[str], label: re.Pattern, lookahead: int = 3, start: int = 0, end: int | None = None):
    """Consecutive amounts following the first line matching `label`:
    on the label's own line, or on the next few lines (skipping wrapped
    label text). [] when nothing is found."""
    end = len(lines) if end is None else end
    for i in range(start, end):
        match = label.search(lines[i])
        if not match:
            continue
        tail = inline_amounts(lines[i][match.end():])
        if tail:
            return tail
        found: list[int] = []
        for j in range(i + 1, min(i + 1 + lookahead + 3, end)):
            amount = line_amount(lines[j])
            if amount is not None:
                found.append(amount)
                continue
            if found or _ITEM_MARKER.match(lines[j]) or j - i > lookahead:
                break
        if found:
            return found
    return []


def amount_after(lines: list[str], label: re.Pattern, **kwargs) -> int | None:
    found = amounts_after(lines, label, **kwargs)
    return found[0] if found else None


def value_after(lines: list[str], label: re.Pattern) -> str | None:
    for i, line in enumerate(lines):
        match = label.match(line)
        if not match:
            continue
        rest = line[match.end():].strip(" :-")
        if rest:
            return rest
        if i + 1 < len(lines):
            return lines[i + 1]
    return None


def parse_date(raw: str | None) -> str | None:
    if not raw:
        return None
    m = DATE_RE.search(raw)
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
    except ValueError:
        return None


def assessment_year_from(lines: list[str]) -> str | None:
    text = " ".join(lines)
    if m := AY_RE.search(text):
        return f"{m.group(1)}-{m.group(2)}"
    if m := FY_RE.search(text):
        start = int(m.group(1)) + 1
        return f"{start}-{(start + 1) % 100:02d}"
    return None


def set_name(ex: Extraction, full_name: str | None) -> None:
    if not full_name:
        return
    parts = [p for p in re.sub(r"[^A-Za-z .'-]", " ", full_name).split() if p]
    if not parts:
        return
    if len(parts) == 1:
        ex.set("personal.last_name", parts[0])
        return
    ex.set("personal.first_name", parts[0])
    ex.set("personal.last_name", parts[-1])
    if len(parts) > 2:
        ex.set("personal.middle_name", " ".join(parts[1:-1]))


def set_address(ex: Extraction, address: str | None) -> None:
    if not address:
        return
    if m := re.search(r"\b([1-9]\d{5})\b", address):
        ex.set("personal.address.pin_code", m.group(1))
    lowered = address.lower()
    for name, code in STATE_CODES.items():
        if name in lowered:
            ex.set("personal.address.state_code", code)
            break
    parts = [p.strip(" -") for p in re.sub(r"\b[1-9]\d{5}\b", "", address).split(",")]
    parts = [p for p in parts if p and not any(name in p.lower() for name in STATE_CODES)]
    if not parts:
        return
    ex.set("personal.address.flat_no", parts[0][:50])
    if len(parts) >= 2:
        ex.set("personal.address.city", parts[-1][:50])
    if len(parts) >= 3:
        ex.set("personal.address.locality", parts[-2][:50])
    if len(parts) >= 4:
        ex.set("personal.address.building", ", ".join(parts[1:-2])[:50])


def address_parts(address: str) -> dict:
    """Splits "FLAT 1, TOWER B, AREA, CITY, STATE - 411014" into fields."""
    out: dict = {}
    if m := re.search(r"\b([1-9]\d{5})\b", address):
        out["pin_code"] = m.group(1)
    lowered = address.lower()
    for name, code in STATE_CODES.items():
        if name in lowered:
            out["state_code"] = code
            break
    parts = [p.strip(" -") for p in re.sub(r"\b[1-9]\d{5}\b", "", address).split(",")]
    parts = [p for p in parts if p and not any(name in p.lower() for name in STATE_CODES)]
    if parts:
        out["street"] = ", ".join(parts[:-1])[:50] if len(parts) > 1 else parts[0][:50]
        out["city"] = parts[-1][:50] if len(parts) > 1 else None
    return out


def employer_address(lines: list[str], employer: str | None) -> dict:
    """Address lines that follow the employer's name, up to the PIN code."""
    if not employer:
        return {}
    for i, line in enumerate(lines):
        if line.startswith(employer[:20]):
            collected = []
            for nxt in lines[i + 1 : i + 6]:
                if re.search(r"\+?\(?91\)?|@|^PAN|^TAN|^CIN", nxt):
                    break
                collected.append(nxt)
                if re.search(r"\b[1-9]\d{5}\b", nxt):
                    break
            text = " ".join(collected)
            parts = address_parts(text) if re.search(r"\b[1-9]\d{5}\b", text) else {}
            # Two-column layouts can interleave the employee's address; only
            # trust a block that ends in "STATE - PIN" like TRACES prints it.
            return parts if parts.get("state_code") and parts.get("city") else {}
    return {}


def employee_pan(lines: list[str]) -> str | None:
    """The individual's PAN, never the employer's/deductor's."""
    text = "\n".join(lines)
    if m := re.search(r"PAN of (?:the )?Employee[^:\n]*:\s*([A-Z]{5}\d{4}[A-Z])", text, re.IGNORECASE):
        return m.group(1)

    excluded = set(re.findall(r"(?:Deductor|Employer|Collector)[^\n:]*:\s*([A-Z]{5}\d{4}[A-Z])", text, re.IGNORECASE))
    for line in lines:
        if re.search(r"\b(?:TAN|CIN)\b", line):  # employer letterhead line
            excluded.update(PAN_RE.findall(line))
    candidates = [p for line in lines for p in PAN_RE.findall(line) if p not in excluded]
    # The 4th character of an individual's PAN is "P" (a company's is "C").
    return next((p for p in candidates if p[3] == "P"), candidates[0] if candidates else None)


def company_name(lines: list[str]) -> str | None:
    for line in lines:
        if re.search(r"not a real document|specimen|synthetic", line, re.IGNORECASE):
            continue
        if m := COMPANY_RE.match(line):
            return m.group(1).strip()[:125]
    return None


def first_tan(lines: list[str]) -> str | None:
    return next((m.group(1) for line in lines if (m := TAN_RE.search(line))), None)


def _index(lines: list[str], pattern: str, start: int = 0) -> int | None:
    rx = re.compile(pattern, re.IGNORECASE)
    return next((i for i in range(start, len(lines)) if rx.search(lines[i])), None)


def _set_hra_basis(ex: Extraction, text: str) -> None:
    if m := re.search(r"(40|50)\s*%\s*(?:of Basic[^\n]*?)?x\s*([\d,]{5,})", text, re.IGNORECASE):
        ex.set("salary.hra.basic_salary", to_int(m.group(2)))
        if m.group(1) == "50":
            ex.set("salary.hra.is_metro", True)
    if m := re.search(rf"Rent paid\s*{_CURRENCY}?\s*([\d,]+)\s*(?:/|per|x)\s*(?:month|12)", text, re.IGNORECASE):
        ex.set("salary.hra.rent_paid", to_int(m.group(1)) * 12)


# ---------------------------------------------------------------------------
# Form 16
# ---------------------------------------------------------------------------


def parse_form16(lines: list[str]) -> Extraction:
    ex = Extraction(assessment_year=assessment_year_from(lines))
    part_b = _index(lines, r"^PART\s*B\b") or len(lines)

    ex.set("personal.pan", employee_pan(lines))
    tan = first_tan(lines)
    employer = company_name(lines)

    ex.set("salary.salary_17_1", amount_after(lines, re.compile(r"17\s*\(1\)")))
    ex.set("salary.perquisites_17_2", amount_after(lines, re.compile(r"17\s*\(2\)")))
    ex.set("salary.profits_17_3", amount_after(lines, re.compile(r"17\s*\(3\)")))
    ex.set("salary.lta_exemption", amount_after(lines, re.compile(r"10\s*\(5\)")))
    ex.set("salary.gratuity_exemption", amount_after(lines, re.compile(r"10\s*\(10\)")))
    ex.set("salary.leave_encashment_exemption", amount_after(lines, re.compile(r"10\s*\(10AA\)")))
    ex.set("salary.professional_tax", amount_after(lines, re.compile(r"16\s*\(iii\)", re.IGNORECASE)))

    # HRA working from the annexure (actual HRA, rent and basic).
    ex.set("salary.hra.hra_received", amount_after(lines, re.compile(r"^HRA received$", re.IGNORECASE)))
    ex.set("salary.hra.rent_paid", amount_after(lines, re.compile(r"^Rent paid$", re.IGNORECASE)))
    _set_hra_basis(ex, "\n".join(lines))

    chargeable = amount_after(lines, re.compile(r"chargeable under the head\s*['\"‘’“”]?\s*salar", re.IGNORECASE))

    # Part A summary: the "Total" row is amount paid, tax deducted[, deposited].
    tds = None
    total_row = _index(lines[:part_b], r"^Total\b")
    if total_row is not None:
        found = amounts_after(lines, re.compile(r"^Total\b"), start=total_row, end=part_b)
        if len(found) >= 2:
            tds = found[1]
    if tds is None:
        tds = amount_after(lines, re.compile(r"^\d*\.?\s*Tax deducted at source", re.IGNORECASE))

    if employer or tan or chargeable or tds:
        addr = employer_address(lines, employer)
        ex.add_row(
            "salary.employers",
            {"name": employer, "tan": tan, "income_chargeable": chargeable or 0, "tds": tds or 0,
             "address": addr.get("street"), "city": addr.get("city"), "state_code": addr.get("state_code"),
             "pin_code": addr.get("pin_code")},
        )

    _form16_deductions(ex, lines)
    return ex


def _form16_deductions(ex: Extraction, lines: list[str]) -> None:
    """Chapter VI-A details. Only used under the old regime, but recorded so
    switching regimes doesn't mean re-typing them."""
    ccd_1b = amounts_after(lines, re.compile(r"80CCD\s*\(1B\)", re.IGNORECASE))
    if ccd_1b:
        ex.set("deductions.section_80ccd_1b", ccd_1b[-1])
    ccd_2 = amounts_after(lines, re.compile(r"80CCD\s*\(2\)", re.IGNORECASE))
    if ccd_2:
        ex.set("deductions.section_80ccd_2", ccd_2[-1])
    if m := re.search(r"PRAN[^\d\n]*(\d{12})\b", "\n".join(lines)):
        ex.set("deductions.pran", m.group(1))

    for i, line in enumerate(lines):
        if m := re.match(r"^80C\s*[-–]\s*(.+)$", line):
            amount = amount_after(lines, re.compile(re.escape(line)), start=i)
            details = lines[i + 1] if i + 1 < len(lines) and line_amount(lines[i + 1]) is None else ""
            policy = re.search(r"(?:policy|folio|account)\s*no\.?\s*([A-Z0-9/-]{4,})", details, re.IGNORECASE)
            ex.add_row(
                "deductions.section_80c",
                {
                    "description": m.group(1).strip()[:50],
                    "identification_no": policy.group(1) if policy and "X" not in policy.group(1).upper() else None,
                    "amount": amount or 0,
                },
            )
        elif m := re.match(r"^80D\s*[-–]\s*(.+)$", line):
            label = m.group(1).lower()
            bucket = "health_parents" if "parent" in label else "health_self"
            details = lines[i + 1] if i + 1 < len(lines) and line_amount(lines[i + 1]) is None else ""
            amount = amount_after(lines, re.compile(re.escape(line)), start=i)
            ex.set(f"deductions.{bucket}.claiming", True)
            if "senior" in label:
                ex.set(f"deductions.{bucket}.includes_senior_citizen", True)
            ex.add_row(f"deductions.{bucket}.policies", {"insurer": details[:125] or None, "premium": amount or 0})


# ---------------------------------------------------------------------------
# AIS
# ---------------------------------------------------------------------------

_INCOME_CATEGORIES = [
    (re.compile(r"^Salary\b", re.IGNORECASE), "salary.salary_17_1"),
    (re.compile(r"interest .*saving|saving.* interest", re.IGNORECASE), "other_income.savings_interest"),
    (re.compile(r"interest .*(?:time )?deposit|deposit.* interest|interest income - time", re.IGNORECASE),
     "other_income.deposit_interest"),
    (re.compile(r"interest .*refund", re.IGNORECASE), "other_income.refund_interest"),
]
_SALE_RE = re.compile(r"sale of (?:securities|units|immovable|land|shares)|SFT-01[78]\b", re.IGNORECASE)
_DIVIDEND_BUCKETS = [
    ((6, 15), "upto_15_jun"),
    ((9, 15), "jun_16_to_sep_15"),
    ((12, 15), "sep_16_to_dec_15"),
    ((3, 15), "dec_16_to_mar_15"),
    ((3, 31), "mar_16_to_mar_31"),
]


def _dividend_bucket(day: date) -> str:
    # Compare in financial-year order (April = 0 ... March = 11).
    fy_month = (day.month - 4) % 12
    for (month, dom), key in _DIVIDEND_BUCKETS:
        limit = (month - 4) % 12
        if fy_month < limit or (fy_month == limit and day.day <= dom):
            return key
    return "mar_16_to_mar_31"


def _ais_tis(ex: Extraction, lines: list[str]) -> bool:
    """Taxpayer Information Summary: one derived value per income category."""
    start = _index(lines, r"Taxpayer Information Summary")
    if start is None:
        return False
    for i in range(start, len(lines)):
        line = lines[i]
        found = []
        for j in range(i + 1, min(i + 5, len(lines))):
            amount = line_amount(lines[j])
            if amount is not None:
                found.append(amount)
            elif lines[j] != "-":
                break
        if not found:
            continue
        value = found[-1]  # derived value
        for pattern, path in _INCOME_CATEGORIES:
            if pattern.search(line):
                ex.set(path, value)
        if re.search(r"^Dividend", line, re.IGNORECASE):
            ex.fields.setdefault("_dividend_total", value)
        if _SALE_RE.search(line) and value > 0:
            ex.set("eligibility.has_capital_gains", True)
            ex.note(CAPITAL_GAINS_NOTE)
    return True


def _ais_tds_sections(ex: Extraction, lines: list[str]) -> bool:
    """Per-deductor TDS/TCS detail tables: `TDS-194A : description - NAME (TAN)`."""
    header = re.compile(r"^(T[DC]S-[\w()]+)\s*:\s*(.+?)\s+-\s+(.+?)\s*\(([A-Z]{4}\d{5}[A-Z])\)\s*$")
    found_any = False
    i = 0
    while i < len(lines):
        m = header.match(lines[i])
        if not m:
            i += 1
            continue
        code, description, source, tan = m.groups()
        amounts: list[int] = []
        j = i + 1
        while j < len(lines) and not header.match(lines[j]) and not re.match(r"^Part [A-Z]\d", lines[j]):
            amount = line_amount(lines[j])
            if amount is not None:
                amounts.append(amount)
            j += 1
        i = j
        if len(amounts) < 2:
            continue
        # Each row: amount paid/credited, tax deducted, tax deposited.
        width = 3 if len(amounts) % 3 == 0 else 2
        paid, deducted = sum(amounts[0::width]), sum(amounts[1::width])
        found_any = True
        section = code.split("-", 1)[1].upper()
        if code.startswith("TCS"):
            ex.add_row("taxes_paid.tcs", {"collector_name": source.strip()[:125], "tan": tan,
                                          "amount_collected": deducted, "amount_claimed": deducted})
        elif section == "192":
            ex.add_row("salary.employers", {"name": source.strip()[:125], "tan": tan, "tds": deducted})
            ex.set("salary.salary_17_1", paid)
        elif deducted > 0:
            ex.add_row("taxes_paid.tds_other", {
                "deductor_name": source.strip()[:125], "tan": tan,
                "section": TDS_SECTION_CODES.get(section, "94A"),
                "amount_paid": paid, "tds_deducted": deducted, "tds_claimed": deducted,
            })
        _map_income(ex, description, paid, from_tds=True)
    return found_any


def _map_income(ex: Extraction, description: str, amount: int, from_tds: bool = False) -> None:
    for pattern, path in _INCOME_CATEGORIES:
        if pattern.search(description):
            if not (from_tds and path == "salary.salary_17_1"):
                ex.set(path, amount)
            return


def _ais_dividends(ex: Extraction, lines: list[str]) -> None:
    buckets: dict[str, int] = {}
    for i, line in enumerate(lines):
        if line.strip().lower() != "dividend":
            continue
        amount = next((a for a in (line_amount(x) for x in lines[i + 1 : i + 3]) if a is not None), None)
        when = next((parse_date(x) for x in lines[i + 1 : i + 4] if parse_date(x)), None)
        if amount and when:
            key = _dividend_bucket(date.fromisoformat(when))
            buckets[key] = buckets.get(key, 0) + amount
    total = ex.fields.pop("_dividend_total", None)
    if buckets and (total is None or sum(buckets.values()) == total):
        for key, amount in buckets.items():
            ex.set(f"other_income.dividends.{key}", amount)
    elif total:
        ex.note(f"Dividend income of Rs {total:,} found — enter its quarterly breakup in ITR Filing.")


def _ais_summary_rows(ex: Extraction, lines: list[str], has_details: bool, has_tis: bool) -> None:
    """Fallback for AIS layouts with one summary row per item:
    code, description, source/TAN, [count], amount[, TDS]."""
    code_re = re.compile(r"^(?:SFT|TDS|TCS)-[\w()/.-]+$")
    part = ""
    per_part: dict[tuple[str, str], int] = {}
    i = 0
    while i < len(lines):
        if m := re.match(r"^Part ([A-Z]\d*)", lines[i]):
            part = m.group(1)
        if not code_re.match(lines[i]):
            i += 1
            continue
        code = lines[i]
        j = i + 1
        window: list[str] = []
        while j < len(lines) and len(window) < 6 and not code_re.match(lines[j]) and not re.match(r"^Part ", lines[j]):
            window.append(lines[j])
            j += 1
        i = j
        description = next((w for w in window if re.search(r"[a-z]{3,}", w)), "")
        tan = next((t.group(1) for w in window if (t := TAN_RE.search(w))), None)
        amounts = [a for a in (line_amount(w) for w in window) if a is not None]
        if not description or not amounts:
            continue
        if _SALE_RE.search(code) or _SALE_RE.search(description):
            ex.set("eligibility.has_capital_gains", True)
            ex.note(CAPITAL_GAINS_NOTE)
            continue
        if not has_tis:
            for pattern, path in _INCOME_CATEGORIES:
                if pattern.search(description):
                    per_part[(part, path)] = per_part.get((part, path), 0) + amounts[0]
                    break
        is_tds = "TDS-" in code or "TCS-" in code
        if is_tds and not has_details and len(amounts) > 1:
            tds = amounts[1]
            section = re.search(r"T[DC]S-(\w+)", code).group(1)
            if section == "192":
                ex.add_row("salary.employers", {"tan": tan, "tds": tds})
            elif tds > 0:
                ex.add_row("taxes_paid.tds_other", {
                    "tan": tan, "section": TDS_SECTION_CODES.get(section, "94A"),
                    "amount_paid": amounts[0], "tds_deducted": tds, "tds_claimed": tds,
                })
        if "dividend" in description.lower() and not has_tis:
            ex.fields["_dividend_total"] = ex.fields.get("_dividend_total", 0) + amounts[0]
    # The same income can appear in several AIS parts; take the largest part total.
    best: dict[str, int] = {}
    for (_, path), amount in per_part.items():
        best[path] = max(best.get(path, 0), amount)
    for path, amount in best.items():
        ex.set(path, amount)


ISIN_RE = re.compile(r"^IN[EF][0-9A-Z]{9}$")
_DERIVATIVES_RE = re.compile(r"\b(?:futures?|options?|F&O|derivative)\b", re.IGNORECASE)


def _ais_capital_gains(ex: Extraction, lines: list[str]) -> None:
    """Classifies each security sale in the AIS (SFT-018 detail rows) so the
    right ITR form can be chosen. Gains are sale consideration minus cost as
    reported in the AIS — indicative only; the broker statement is final."""
    gains = {"ltcg_112a": 0, "stcg_111a": 0, "debt_stcg": 0, "speculative": 0, "sales": 0, "trades": 0}
    anchors = [i for i, line in enumerate(lines) if ISIN_RE.match(line)]
    for n, i in enumerate(anchors):
        end = anchors[n + 1] if n + 1 < len(anchors) else min(len(lines), i + 25)
        window = lines[i:end]
        before = " ".join(lines[max(0, i - 3) : i]).lower()
        text = " ".join(window).lower()
        amounts = [a for a in (line_amount(w) for w in window) if a is not None]
        if len(amounts) < 2:
            continue
        sale, cost = amounts[-2], amounts[-1]
        gain = sale - cost
        gains["sales"] += sale
        gains["trades"] += 1
        date_index = next((j for j, w in enumerate(window) if DATE_RE.fullmatch(w.strip())), None)
        name = " ".join(window[1:date_index]) if date_index else ""
        sale_date = parse_date(window[date_index]) if date_index is not None else None
        quantity = next(
            (float(w) for w in window[(date_index or 0) + 1 :] if re.fullmatch(r"\d+(?:\.\d+)?", w.strip())), 0.0
        )
        if "intraday" in text:
            gains["speculative"] += gain
            turnover = ex.fields.get("trading.speculative_turnover", 0) + abs(gain)
            ex.fields["trading.speculative_turnover"] = turnover
            ex.fields["trading.speculative_profit"] = ex.fields.get("trading.speculative_profit", 0) + gain
            continue
        if "debt" in before or "50aa" in before:
            gains["debt_stcg"] += gain
            asset_type, term = "debt_mf", "short"
        else:
            asset_type = "equity_mf" if re.search(r"\bmf\b|fund", before) else "equity_share"
            term = "long" if "long term" in text else "short"
            gains["ltcg_112a" if term == "long" else "stcg_111a"] += gain
        ex.add_row("capital_gains", {
            "asset_type": asset_type, "term": term, "name": name[:125] or None, "isin": window[0],
            "quantity": quantity, "sale_date": sale_date, "sale_value": sale, "cost": cost,
        })

    text_all = " ".join(lines)
    if gains["trades"]:
        ex.facts["capital_gains"] = gains
    elif _SALE_RE.search(text_all):
        ex.facts["capital_gains"] = {"detail_missing": True}
    if gains["speculative"] or "intraday" in text_all.lower():
        ex.facts["intraday"] = True
    if _DERIVATIVES_RE.search(text_all):
        ex.facts["derivatives"] = True


def parse_ais_pdf(lines: list[str]) -> Extraction:
    ex = Extraction(assessment_year=assessment_year_from(lines))
    ex.set("personal.pan", employee_pan(lines))
    set_name(ex, value_after(lines, re.compile(r"Name(?: of (?:the )?Assessee)?$", re.IGNORECASE)))
    ex.set("personal.date_of_birth", parse_date(value_after(lines, re.compile(r"Date of birth", re.IGNORECASE))))
    set_address(ex, value_after(lines, re.compile(r"Address$", re.IGNORECASE)))
    email = value_after(lines, re.compile(r"E-?mail(?: Address)?$|Mobile / Email$", re.IGNORECASE))
    if email and (m := re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", email)):
        ex.set("personal.email", m.group(0))

    identity = ex.facts.setdefault("identity", {})
    aadhaar = value_after(lines, re.compile(r"Aadhaar(?: Number| No\.?)?$", re.IGNORECASE))
    if aadhaar and (m := re.search(r"(\d{4})\s*$", aadhaar)):
        identity["aadhaar_last4"] = m.group(1)
    mobile = value_after(lines, re.compile(r"Mobile(?: Number| No\.?)?$", re.IGNORECASE))
    if mobile and (m := re.search(r"([0-9X]{10})\s*$", mobile.replace(" ", ""))):
        identity["mobile_mask"] = m.group(1)
    if email and (m := re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", email)):
        identity["email"] = m.group(0)
    if not identity:
        ex.facts.pop("identity")

    has_tis = _ais_tis(ex, lines)
    has_details = _ais_tds_sections(ex, lines)
    _ais_summary_rows(ex, lines, has_details, has_tis)
    _ais_dividends(ex, lines)
    _ais_capital_gains(ex, lines)
    return ex


def _walk(obj):
    if isinstance(obj, dict):
        yield obj
        for value in obj.values():
            yield from _walk(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from _walk(value)


def _get(d: dict, *names: str):
    lowered = {k.lower().replace("_", ""): v for k, v in d.items()}
    for name in names:
        if (value := lowered.get(name.lower().replace("_", ""))) not in (None, ""):
            return value
    return None


def parse_ais_json(data: bytes) -> Extraction:
    obj = json.loads(data)
    ex = Extraction()
    for d in _walk(obj):
        ay = _get(d, "AssessmentYear")
        if isinstance(ay, str) and re.fullmatch(r"20\d{2}-\d{2}", ay):
            ex.assessment_year = ex.assessment_year or ay
        if (pan := _get(d, "PAN")) and isinstance(pan, str) and PAN_RE.fullmatch(pan):
            ex.set("personal.pan", pan)
            set_name(ex, _get(d, "Name", "AssesseeName"))
            dob = _get(d, "DOB", "DateOfBirth")
            if isinstance(dob, str):
                ex.set("personal.date_of_birth", dob if re.fullmatch(r"\d{4}-\d{2}-\d{2}", dob) else parse_date(dob))
            if isinstance(address := _get(d, "Address"), str):
                set_address(ex, address)
            if isinstance(email := _get(d, "Email", "EmailAddress"), str):
                ex.set("personal.email", email)

        description = _get(d, "Description", "InformationDescription")
        amount = _get(d, "AmountPaidCredited", "Amount", "AmountPaid")
        if not (isinstance(description, str) and isinstance(amount, (int, float))):
            continue
        code = str(_get(d, "InformationCode", "Section") or "")
        if _SALE_RE.search(code) or _SALE_RE.search(description):
            ex.set("eligibility.has_capital_gains", True)
            ex.note(CAPITAL_GAINS_NOTE)
            ex.facts.setdefault("capital_gains", {"detail_missing": True})
            continue
        tds = _get(d, "TaxDeducted", "TDS", "TDSDeducted")
        tds = round(tds) if isinstance(tds, (int, float)) else 0
        source, tan = _get(d, "Source", "Deductor"), _get(d, "TAN")
        _map_income(ex, description, round(amount))
        if "salary" in description.lower():
            ex.add_row("salary.employers", {"name": source, "tan": tan, "tds": tds})
        elif tds > 0:
            section = re.search(r"(19[2-6][A-Z]{0,2})", code)
            ex.add_row("taxes_paid.tds_other", {
                "deductor_name": source, "tan": tan,
                "section": TDS_SECTION_CODES.get(section.group(1), "94A") if section else "94A",
                "amount_paid": round(amount), "tds_deducted": tds, "tds_claimed": tds,
            })
    return ex


# ---------------------------------------------------------------------------
# Payslip, PAN
# ---------------------------------------------------------------------------


def parse_payslip(lines: list[str]) -> Extraction:
    ex = Extraction()
    ex.set("personal.pan", employee_pan(lines))
    set_name(ex, value_after(lines, re.compile(r"(?:Employee\s+)?Name$", re.IGNORECASE)))
    text = "\n".join(lines)

    month = re.search(r"pay\s*slip\s+for\s+(?:the\s+month\s+of\s+)?([a-z]{3})[a-z]*\s+(20\d{2})", text, re.IGNORECASE)
    is_march = bool(month and month.group(1).lower() == "mar")

    def current_and_ytd(pattern: str) -> tuple[int | None, int | None]:
        found = amounts_after(lines, re.compile(pattern, re.IGNORECASE), lookahead=1)
        return (found[0] if found else None, found[1] if len(found) > 1 else None)

    basic, basic_ytd = current_and_ytd(r"^Basic(?: Salary| Pay)?$")
    hra, hra_ytd = current_and_ytd(r"^(?:House Rent Allowance|HRA)$")
    da, da_ytd = current_and_ytd(r"^(?:Dearness Allowance|DA)$")
    _pt, pt_ytd = current_and_ytd(r"^Professional Tax$")
    _gross, gross_ytd = current_and_ytd(r"^Gross (?:Earnings|Salary|Pay)$")
    _tds, tds_ytd = current_and_ytd(r"^Income Tax(?: \(TDS\))?$|^TDS$")

    if gross_ytd is None and (m := re.search(rf"YTD gross[^:]*:\s*{_CURRENCY}?\s*([\d,]+)", text, re.IGNORECASE)):
        gross_ytd = to_int(m.group(1))
    if tds_ytd is None and (m := re.search(rf"YTD TDS[^:]*:\s*{_CURRENCY}?\s*([\d,]+)", text, re.IGNORECASE)):
        tds_ytd = to_int(m.group(1))

    if is_march:
        # A March payslip's year-to-date column is the full financial year.
        ex.set("salary.salary_17_1", gross_ytd)
        ex.set("salary.hra.basic_salary", basic_ytd)
        ex.set("salary.hra.hra_received", hra_ytd)
        ex.set("salary.hra.dearness_allowance", da_ytd)
        ex.set("salary.professional_tax", pt_ytd)
    if not (is_march and basic_ytd):
        if basic:
            ex.set("salary.hra.basic_salary", basic * 12)
        if hra:
            ex.set("salary.hra.hra_received", hra * 12)
        if da:
            ex.set("salary.hra.dearness_allowance", da * 12)
        if basic or hra:
            ex.note("HRA inputs are estimated as 12 x the monthly payslip amounts — check them.")
    _set_hra_basis(ex, text)

    employer = company_name(lines)
    tan = first_tan(lines)
    if employer or tan:
        ex.add_row("salary.employers", {"name": employer, "tan": tan, "tds": tds_ytd if is_march else None})
    bank = value_after(lines, re.compile(r"Bank\s*/?\s*A/?c(?: No\.?)?$", re.IGNORECASE))
    if bank and (m := re.search(r"(\d{4})\s*$", bank)):
        ex.facts["identity"] = {"bank_accounts": [m.group(1)]}
    return ex


def parse_pan(lines: list[str]) -> Extraction:
    ex = Extraction()
    pan = None
    for i, line in enumerate(lines):
        if re.search(r"Permanent Account Number", line, re.IGNORECASE):
            if m := PAN_RE.search(" ".join(lines[i : i + 2])):
                pan = m.group(1)
    ex.set("personal.pan", pan or employee_pan(lines))
    set_name(ex, value_after(lines, re.compile(r"Name$", re.IGNORECASE)))
    ex.set("personal.father_name", value_after(lines, re.compile(r"Father'?s Name$", re.IGNORECASE)))
    ex.set("personal.date_of_birth", parse_date(value_after(lines, re.compile(r"Date of Birth", re.IGNORECASE))))
    return ex


def parse_form26as(lines: list[str]) -> Extraction:
    """Form 26AS Part-I: one block per deductor — name, TAN, total paid,
    total deducted, total deposited — followed by rows with the section."""
    ex = Extraction(assessment_year=assessment_year_from(lines))
    ex.set("personal.pan", employee_pan(lines))
    set_name(ex, value_after(lines, re.compile(r"Name of Assessee$", re.IGNORECASE)))
    set_address(ex, value_after(lines, re.compile(r"Address of$|Address of Assessee$", re.IGNORECASE)))

    end = _index(lines, r"^PART-?\s*II\b") or len(lines)
    entries = []
    tan_lines = [i for i in range(end) if re.fullmatch(r"[A-Z]{4}\d{5}[A-Z]", lines[i])]
    for n, i in enumerate(tan_lines):
        block_end = tan_lines[n + 1] if n + 1 < len(tan_lines) else end
        amounts = []
        for line in lines[i + 1 : block_end]:
            amount = line_amount(line)
            if amount is None:
                if amounts:
                    break
                continue
            amounts.append(amount)
        section = next(
            (m.group(1) for line in lines[i + 1 : block_end] if (m := re.fullmatch(r"(19\d[A-Z]{0,3})", line))),
            None,
        )
        if len(amounts) < 2 or section is None:
            continue
        name = lines[i - 1].strip()[:125]
        entries.append({"tan": lines[i], "name": name, "section": section, "paid": amounts[0], "tds": amounts[1]})

    for e in entries:
        if e["section"] == "192":
            ex.add_row("salary.employers", {"name": e["name"], "tan": e["tan"], "tds": e["tds"]})
        elif e["tds"] > 0:
            ex.add_row("taxes_paid.tds_other", {
                "deductor_name": e["name"], "tan": e["tan"],
                "section": TDS_SECTION_CODES.get(e["section"], "94A"),
                "amount_paid": e["paid"], "tds_deducted": e["tds"], "tds_claimed": e["tds"],
            })
    if entries:
        ex.facts["tds_26as"] = entries
    return ex


def _section(lines: list[str], start_pattern: str, end_pattern: str) -> list[str]:
    start = _index(lines, start_pattern)
    if start is None:
        return []
    end = _index(lines, end_pattern, start + 1) or len(lines)
    return lines[start:end]


def _broker_capital_rows(ex: Extraction, rows_text: list[str], mutual_funds: bool) -> None:
    """Delivery / mutual-fund sale rows anchored on the ISIN."""
    anchors = [i for i, line in enumerate(rows_text) if ISIN_RE.match(line)]
    for n, i in enumerate(anchors):
        end = anchors[n + 1] if n + 1 < len(anchors) else len(rows_text)
        window = rows_text[i:end]
        name_lines = []
        j = i - 1
        while j >= 0 and not re.fullmatch(r"\d+", rows_text[j].strip()) and not ISIN_RE.match(rows_text[j]):
            name_lines.insert(0, rows_text[j])
            j -= 1
        name = " ".join(name_lines).strip()
        text = " ".join(window)
        dates = [parse_date(w) for w in window if DATE_RE.fullmatch(w.strip())]
        amounts = [a for a in (line_amount(w) for w in window) if a is not None]
        qty = next((float(w) for w in window[1:] if re.fullmatch(r"\d+(?:\.\d+)?", w.strip())), 0.0)
        if len(dates) < 2:
            continue
        lowered = text.lower()
        if mutual_funds:
            debt = "debt" in lowered or "50aa" in lowered
            # Units, purchase NAV and redemption NAV have 3-4 decimals: not money lines.
            cost, sale = amounts[0], amounts[1]
            asset_type = "debt_mf" if debt else "equity_mf"
            term = "short" if debt else ("long" if re.search(r"\bLT\b", text) else "short")
        else:
            # buy rate, buy value, sell rate, sell value, [days], P&L, charges
            cost, sale = amounts[1], amounts[3]
            asset_type = "equity_share"
            term = "long" if re.search(r"\bLT\b", text) else "short"
        purchase = dates[0]
        ex.add_row("capital_gains", {
            "asset_type": asset_type, "term": term, "name": name[:125] or None, "isin": window[0],
            "quantity": qty, "purchase_date": purchase, "sale_date": dates[1], "sale_value": sale, "cost": cost,
            "acquired_before_feb_2018": bool(purchase and purchase <= "2018-01-31"),
        })


def parse_broker_pnl(lines: list[str]) -> Extraction:
    """Broker capital gains & trading statement (tax P&L): delivery and
    mutual-fund sales with purchase dates, intraday and F&O net of charges,
    and turnover for the tax-audit limit."""
    ex = Extraction(assessment_year=assessment_year_from(lines))
    ex.set("personal.pan", employee_pan(lines))
    email = value_after(lines, re.compile(r"E-?mail$", re.IGNORECASE))
    if email and (m := re.search(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+", email)):
        ex.facts.setdefault("identity", {})["email"] = m.group(0)
    bank = value_after(lines, re.compile(r"Bank A/?c", re.IGNORECASE))
    if bank and (m := re.search(r"(\d{4})\s*$", bank)):
        ex.facts.setdefault("identity", {})["bank_accounts"] = [m.group(1)]

    delivery = _section(lines, r"EQUITY\s*-\s*DELIVERY", r"EQUITY\s*-\s*INTRADAY|DERIVATIVES|MUTUAL FUNDS")
    _broker_capital_rows(ex, delivery, mutual_funds=False)
    funds = _section(lines, r"^\d+\.\s*MUTUAL FUNDS", r"DIVIDENDS|CHARGES")
    _broker_capital_rows(ex, funds, mutual_funds=True)

    def totals(section: list[str]) -> list[int]:
        """Amounts on the section's "Total" row (gross P&L, charges, net P&L are the last three)."""
        i = next((k for k in range(len(section) - 1, -1, -1) if section[k].strip() == "Total"), None)
        if i is None:
            return []
        out = []
        for line in section[i + 1 :]:
            raw = line.strip()
            m = re.fullmatch(r"(-)?\s*(" + _GROUPED + r"|\d+)", raw)
            if not m:
                break
            amount = Decimal(m.group(2).replace(",", "")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
            out.append(int(amount) * (-1 if m.group(1) else 1))
        return out

    turnover = {}
    if m := re.search(r"F&O Rs\.?\s*([\d,]+(?:\.\d+)?)", " ".join(lines)):
        turnover["fno"] = round(float(m.group(1).replace(",", "")))
    if m := re.search(r"Intraday Rs\.?\s*([\d,]+(?:\.\d+)?)", " ".join(lines)):
        turnover["intraday"] = round(float(m.group(1).replace(",", "")))

    intraday = _section(lines, r"EQUITY\s*-\s*INTRADAY", r"DERIVATIVES|FUTURES|MUTUAL FUNDS")
    t = totals(intraday)
    if len(t) >= 3:
        # Net of charges: brokerage, STT etc. are business expenses for trading income.
        ex.fields["trading.speculative_profit"] = t[-1]
        ex.set("trading.speculative_turnover", turnover.get("intraday"))
        ex.facts["intraday"] = True
    fno = _section(lines, r"FUTURES\s*&\s*OPTIONS|DERIVATIVES\s*-\s*F", r"MUTUAL FUNDS|DIVIDENDS")
    t = totals(fno)
    if len(t) >= 3:
        gross, charges = t[-3], t[-2]
        ex.fields["trading.fno_profit"] = gross
        ex.set("trading.fno_expenses", charges)
        ex.set("trading.fno_turnover", turnover.get("fno"))
        ex.facts["derivatives"] = True
    if ex.rows.get("capital_gains"):
        ex.set("eligibility.has_capital_gains", True)
        ex.facts.setdefault("capital_gains", {"from_statement": True})
    return ex


_PDF_PARSERS = {
    "form16": parse_form16,
    "ais": parse_ais_pdf,
    "payslips": parse_payslip,
    "pan": parse_pan,
    "form26as": parse_form26as,
    "capital_gains": parse_broker_pnl,
}
EXTRACTABLE_CATEGORIES = set(_PDF_PARSERS)


def extract(category: str, content_type: str, data: bytes, passwords: list[str]) -> Extraction:
    """Raises UnreadableDocument when the file has no usable text."""
    if content_type == "application/json":
        if category != "ais":
            raise UnreadableDocument("Only AIS can be read from a JSON file.")
        return parse_ais_json(data)
    if content_type.startswith("image/"):
        raise UnreadableDocument("Images can't be read automatically yet — enter these details by hand.")
    ex = _PDF_PARSERS[category](pdf_lines(data, passwords))
    ex.fields.pop("_dividend_total", None)
    return ex
