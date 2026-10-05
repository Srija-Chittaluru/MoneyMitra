"""
Human-readable PDF of a prepared ITR-1 — for the taxpayer to review, keep,
or share with a CA. It is NOT the ITR-V acknowledgement (only the e-filing
portal issues that, after the return is filed), and says so on every page.
"""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.modules.itr.rules import ItrYearRules
from app.modules.itr.schemas import ItrDraftData, ItrSummary

_INK = colors.HexColor("#101828")
_MUTED = colors.HexColor("#667085")
_BORDER = colors.HexColor("#d0d5dd")
_SHADE = colors.HexColor("#f2f4f7")
_WARN = colors.HexColor("#dc6803")
_ERROR = colors.HexColor("#d92d20")

_STATES = {
    "01": "Andaman and Nicobar Islands", "02": "Andhra Pradesh", "03": "Arunachal Pradesh", "04": "Assam",
    "05": "Bihar", "06": "Chandigarh", "07": "Dadra and Nagar Haveli", "08": "Daman and Diu", "09": "Delhi",
    "10": "Goa", "11": "Gujarat", "12": "Haryana", "13": "Himachal Pradesh", "14": "Jammu and Kashmir",
    "15": "Karnataka", "16": "Kerala", "17": "Lakshadweep", "18": "Madhya Pradesh", "19": "Maharashtra",
    "20": "Manipur", "21": "Meghalaya", "22": "Mizoram", "23": "Nagaland", "24": "Odisha", "25": "Puducherry",
    "26": "Punjab", "27": "Rajasthan", "28": "Sikkim", "29": "Tamil Nadu", "30": "Tripura", "31": "Uttar Pradesh",
    "32": "West Bengal", "33": "Chhattisgarh", "34": "Uttarakhand", "35": "Jharkhand", "36": "Telangana",
    "37": "Ladakh",
}
_EMPLOYER_CATEGORIES = {
    "CGOV": "Central Government", "SGOV": "State Government", "PSU": "Public Sector Undertaking",
    "PE": "Pensioner – Central Government", "PESG": "Pensioner – State Government", "PEPS": "Pensioner – PSU",
    "PEO": "Pensioner – Others", "OTH": "Others", "NA": "Not applicable",
}


def _rs(amount: int) -> str:
    """Indian digit grouping, e.g. Rs 24,26,430."""
    sign = "-" if amount < 0 else ""
    s = str(abs(int(amount)))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups) + "," + tail
    return f"{sign}Rs {s}"


def _mask(value: str | None, keep: int = 4) -> str:
    if not value:
        return "—"
    value = value.strip()
    return "X" * max(0, len(value) - keep) + value[-keep:]


def _text(value) -> str:
    return str(value).strip() if value not in (None, "") else "—"


class _Builder:
    def __init__(self):
        styles = getSampleStyleSheet()
        self.h1 = ParagraphStyle("h1", parent=styles["Title"], fontSize=16, textColor=_INK, spaceAfter=2)
        self.h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=11.5, textColor=_INK,
                                 spaceBefore=8, spaceAfter=4, keepWithNext=1)
        self.body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9, leading=12, textColor=_INK)
        self.muted = ParagraphStyle("muted", parent=self.body, textColor=_MUTED, fontSize=8.5)
        self.cell = ParagraphStyle("cell", parent=self.body, fontSize=8.8, leading=11)
        self.story: list = []

    def heading(self, text: str) -> None:
        self.story.append(Paragraph(text, self.h2))

    def para(self, text: str, style=None) -> None:
        self.story.append(Paragraph(text, style or self.body))

    def table(self, rows: list[list], widths: list[float], header: bool = False, bold_last: bool = False,
              amount_cols: tuple[int, ...] = ()) -> None:
        data = [[Paragraph(str(c), self.cell) if not isinstance(c, Paragraph) else c for c in row] for row in rows]
        t = Table(data, colWidths=[w * mm for w in widths], hAlign="LEFT")
        style = [
            ("GRID", (0, 0), (-1, -1), 0.4, _BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        if header:
            style.append(("BACKGROUND", (0, 0), (-1, 0), _SHADE))
        if bold_last:
            style.append(("BACKGROUND", (0, -1), (-1, -1), _SHADE))
        t.setStyle(TableStyle(style))
        for col in amount_cols:
            for row in data:
                row[col].style = ParagraphStyle("amt", parent=self.cell, alignment=2)
        self.story.append(t)

    def kv(self, pairs: list[tuple[str, str]]) -> None:
        """Two label/value pairs per row."""
        rows = []
        for i in range(0, len(pairs), 2):
            chunk = pairs[i : i + 2] + [("", "")] * (2 - len(pairs[i : i + 2]))
            rows.append([f"<font color='#667085'>{chunk[0][0]}</font>", chunk[0][1],
                         f"<font color='#667085'>{chunk[1][0]}</font>", chunk[1][1]])
        self.table(rows, [32, 55, 32, 55])

    def amounts(self, rows: list[tuple[str, int]], total_last: bool = False) -> None:
        self.table([[label, _rs(amount)] for label, amount in rows], [134, 40], bold_last=total_last,
                   amount_cols=(1,))


def build_itr_pdf(draft: ItrDraftData, summary: ItrSummary, rules: ItrYearRules) -> bytes:
    b = _Builder()
    s = summary.selected
    p = draft.personal
    a = p.address
    ready = summary.can_export

    name = " ".join(x for x in (p.first_name, p.middle_name, p.last_name) if x) or "—"
    b.story.append(Paragraph(f"ITR-1 (Sahaj) — Assessment Year {rules.assessment_year}", b.h1))
    b.para(
        f"Financial Year {rules.financial_year} &nbsp;·&nbsp; "
        f"{'Belated return u/s 139(4)' if summary.is_belated else 'Original return u/s 139(1)'} &nbsp;·&nbsp; "
        f"{'New' if s.regime == 'new' else 'Old'} tax regime &nbsp;·&nbsp; Prepared on {summary.filing_date:%d %b %Y}",
        b.muted,
    )
    if not ready:
        b.story.append(Spacer(1, 4))
        b.para(
            f"<font color='{_ERROR.hexval()}'><b>DRAFT — NOT READY TO FILE.</b></font> "
            f"{len(summary.eligibility_issues) + len(summary.missing_fields)} item(s) still need attention "
            "(listed at the end).",
            b.body,
        )

    b.heading("Taxpayer")
    address = ", ".join(
        x for x in (a.flat_no, a.building, a.street, a.locality, a.city, _STATES.get(a.state_code or "", None),
                    a.pin_code) if x
    )
    b.kv([
        ("Name", _text(name)), ("PAN", _text(p.pan)),
        ("Father's name", _text(p.father_name)), ("Date of birth", p.date_of_birth.strftime("%d %b %Y")
                                                 if p.date_of_birth else "—"),
        ("Aadhaar", _mask(p.aadhaar)), ("Mobile", _text(p.mobile)),
        ("Email", _text(p.email)), ("Employment", _EMPLOYER_CATEGORIES.get(p.employer_category or "", "—")),
    ])
    b.table([["<font color='#667085'>Address</font>", _text(address)]], [32, 142])

    b.heading("Summary")
    payable = s.balance_payable > 0
    b.table(
        [["Total income", "Tax + interest + fee", "Taxes paid", "Balance payable" if payable else "Refund due"],
         [_rs(s.total_income), _rs(s.total_tax_and_interest), _rs(s.total_taxes_paid),
          _rs(s.balance_payable if payable else s.refund_due)]],
        [43.5, 43.5, 43.5, 43.5], header=True,
    )

    b.heading("Income")
    rows = [
        ("Gross salary (17(1) + 17(2) + 17(3))", s.gross_salary),
        ("Less: exempt allowances u/s 10", s.exempt_allowances),
        ("Less: standard deduction u/s 16(ia)", s.standard_deduction),
    ]
    if s.professional_tax:
        rows.append(("Less: professional tax u/s 16(iii)", s.professional_tax))
    rows += [
        ("Income from salary", s.income_from_salary),
        ("Income from house property", s.income_from_house_property),
        ("Income from other sources", s.income_from_other_sources),
        ("Gross total income", s.gross_total_income),
    ]
    b.amounts(rows, total_last=True)

    o = draft.other_income
    other_rows = [(label, amount) for label, amount in [
        ("Savings account interest", o.savings_interest),
        ("Deposit interest", o.deposit_interest),
        ("Interest on income tax refund", o.refund_interest),
        ("Family pension", o.family_pension),
        ("Dividends", o.dividends.total),
        (f"Other — {o.other_description or 'unspecified'}", o.other_amount),
    ] if amount]
    if other_rows:
        b.para("Other sources breakup", b.muted)
        b.amounts(other_rows)

    b.heading("Deductions and total income")
    ded_rows = [(f"Section {k}", v) for k, v in s.deduction_breakup.items()]
    if not ded_rows:
        ded_rows = [("Chapter VI-A deductions", 0)]
    ded_rows.append(("Total income (rounded u/s 288A)", s.total_income))
    b.amounts(ded_rows, total_last=True)

    b.heading("Tax computation")
    b.amounts([
        ("Tax on total income", s.tax_on_total_income),
        ("Less: rebate u/s 87A", s.rebate_87a),
        ("Tax after rebate", s.tax_after_rebate),
        ("Surcharge", s.surcharge),
        ("Health and education cess @ 4%", s.cess),
        ("Interest u/s 234A (late filing)", s.interest_234a),
        ("Interest u/s 234B (advance tax default)", s.interest_234b),
        ("Interest u/s 234C (advance tax deferment)", s.interest_234c),
        ("Fee u/s 234F (late filing)", s.fee_234f),
        ("Total tax, interest and fee", s.total_tax_and_interest),
    ], total_last=True)

    b.heading("Taxes paid")
    paid_rows = [["Deductor / collector", "TAN", "Section", "Amount credited", "Tax claimed"]]
    for e in draft.salary.employers:
        paid_rows.append([_text(e.name), _text(e.tan), "192 (salary)", _rs(e.income_chargeable), _rs(e.tds)])
    for t in draft.taxes_paid.tds_other:
        paid_rows.append([_text(t.deductor_name), _text(t.tan), t.section, _rs(t.amount_paid), _rs(t.tds_claimed)])
    for t in draft.taxes_paid.tcs:
        paid_rows.append([_text(t.collector_name), _text(t.tan), "TCS", _rs(t.amount_collected),
                          _rs(t.amount_claimed)])
    for c in draft.taxes_paid.challans:
        when = c.date_of_deposit.strftime("%d %b %Y") if c.date_of_deposit else "—"
        paid_rows.append([f"Challan {_text(c.challan_serial_no)} ({when})", f"BSR {_text(c.bsr_code)}",
                          "Advance / SA tax", "", _rs(c.amount)])
    if len(paid_rows) > 1:
        b.table(paid_rows, [58, 26, 28, 31, 31], header=True, amount_cols=(3, 4))
        b.story.append(Spacer(1, 3))
    b.amounts([
        ("TDS", s.tds), ("TCS", s.tcs), ("Advance tax", s.advance_tax),
        ("Self-assessment tax", s.self_assessment_tax), ("Total taxes paid", s.total_taxes_paid),
    ], total_last=True)

    b.heading("Refund / payable")
    b.amounts([("Refund due" if not payable else "Balance tax payable",
                s.refund_due if not payable else s.balance_payable)])
    if draft.bank_accounts:
        bank_rows = [["Bank", "IFSC", "Account no.", "Type", "Refund"]]
        for acc in draft.bank_accounts:
            bank_rows.append([_text(acc.bank_name), _text(acc.ifsc), _mask(acc.account_no), acc.account_type,
                              "Yes" if acc.use_for_refund else ""])
        b.table(bank_rows, [55, 32, 45, 18, 24], header=True)

    if summary.alternative:
        alt = summary.alternative
        b.para(
            f"For comparison, under the {'new' if alt.regime == 'new' else 'old'} regime the total tax, interest "
            f"and fee would be {_rs(alt.total_tax_and_interest)}.",
            b.muted,
        )

    b.heading("Verification")
    b.para(
        f"I, {_text(name)}, son/daughter of {_text(p.father_name)}, solemnly declare that to the best of my "
        "knowledge and belief, the information given in the return is correct and complete and is in accordance "
        "with the provisions of the Income-tax Act, 1961."
    )
    b.para(f"Place: {_text(draft.verification_place)} &nbsp;&nbsp; Date: {summary.filing_date:%d %b %Y}", b.body)

    issues = summary.eligibility_issues + summary.missing_fields
    if issues or summary.warnings:
        items = [f"<font color='{_ERROR.hexval()}'>•</font> {i.message}" for i in issues]
        items += [f"<font color='{_WARN.hexval()}'>•</font> {w}" for w in summary.warnings]
        b.story.append(KeepTogether([Paragraph("Needs attention", b.h2)] + [Paragraph(x, b.body) for x in items]))

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(_MUTED)
        canvas.drawString(15 * mm, 11.5 * mm, "Prepared by MoneyMitra from the details you entered.")
        canvas.drawString(
            15 * mm, 8.5 * mm,
            "Not the ITR-V acknowledgement — that is issued by the Income Tax portal after filing.",
        )
        canvas.drawRightString(A4[0] - 15 * mm, 8.5 * mm, f"Page {doc.page}")
        if not ready:
            canvas.setFillColor(colors.Color(0.85, 0.18, 0.13, alpha=0.10))
            canvas.setFont("Helvetica-Bold", 60)
            canvas.translate(A4[0] / 2, A4[1] / 2)
            canvas.rotate(35)
            canvas.drawCentredString(0, 0, "DRAFT")
        canvas.restoreState()

    out = BytesIO()
    doc = SimpleDocTemplate(
        out, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=18 * mm,
        title=f"ITR-1 AY {rules.assessment_year} — {name}", author="MoneyMitra",
    )
    doc.build(b.story, onFirstPage=decorate, onLaterPages=decorate)
    return out.getvalue()
