"""
ITR-1 eligibility and completeness checks, run before export.

Eligibility issues mean ITR-1 is the wrong form (or the return can no longer
be filed); missing-field issues mean the draft is incomplete or a value is
in the wrong format. Formats mirror the official ITR-1 JSON schema patterns.
"""

import re
from datetime import date

from app.modules.itr.computation import ItrComputation
from app.modules.itr.rules import ItrYearRules
from app.modules.itr.schemas import Issue, ItrDraftData

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
AADHAAR_RE = re.compile(r"^[0-9]{12}$")
MOBILE_RE = re.compile(r"^[1-9][0-9]{9}$")
EMAIL_RE = re.compile(r"^[.a-zA-Z0-9_\-]+@[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9_\-]+)+$")
PIN_RE = re.compile(r"^[1-9][0-9]{5}$")
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
TAN_RE = re.compile(r"^[A-Z]{4}[0-9]{5}[A-Z]$")
BSR_RE = re.compile(r"^[0-9]{3}[0-9A-Z]{4}$")
PRAN_RE = re.compile(r"^[0-9]{12}$")
ISIN_RE = re.compile(r"^IN[0-9A-Z]{10}$")
ACCOUNT_RE = re.compile(r"^[a-zA-Z0-9/-]*[1-9][a-zA-Z0-9/-]*$")
STATE_CODES = {f"{n:02d}" for n in range(1, 38)}

_ELIGIBILITY_QUESTIONS = {
    "is_director": "Directors of a company must file ITR-2.",
    "held_unlisted_shares": "Holding unlisted equity shares requires ITR-2.",
    "has_foreign_assets_or_income": "Foreign assets or foreign income require ITR-2.",
    "has_capital_gains": "Capital gains are not supported in MoneyMitra's ITR-1 yet — use ITR-2.",
    "has_business_income": "Business or professional income requires ITR-3 or ITR-4.",
    "agricultural_income_above_5000": "Agricultural income above Rs 5,000 requires ITR-2.",
    "has_brought_forward_losses": "Losses brought forward or to be carried forward require ITR-2.",
    "tax_deferred_on_esop": "Tax deferred on ESOPs requires ITR-2.",
}


def old_regime_allowed(filing_date: date, rules: ItrYearRules) -> bool:
    """Validation rule 151/190: the old regime can only be chosen in a return
    filed on or before the section 139(1) due date."""
    return filing_date <= rules.due_date


def eligibility_issues(
    draft: ItrDraftData, comp: ItrComputation, rules: ItrYearRules, form_checked: bool = False
) -> list[Issue]:
    """With `form_checked`, the which-form checks (answers, income limit) are
    left to the form selector, which reports them as one issue naming the form."""
    issues: list[Issue] = []
    e = draft.eligibility

    if comp.filing_date > rules.belated_deadline:
        issues.append(
            Issue(
                field=None,
                message=f"The last date for a belated return for AY {rules.assessment_year} "
                f"({rules.belated_deadline:%d %b %Y}) has passed. An updated return (ITR-U) is needed instead.",
            )
        )
    if not form_checked:
        if e.is_resident is False:
            issues.append(Issue(field="eligibility.is_resident", message="ITR-1 is only for residents. Use ITR-2."))
        for key, message in _ELIGIBILITY_QUESTIONS.items():
            if getattr(e, key):
                issues.append(Issue(field=f"eligibility.{key}", message=message))

    if draft.regime == "old" and not old_regime_allowed(comp.filing_date, rules):
        issues.append(
            Issue(
                field="regime",
                message=f"The due date ({rules.due_date:%d %b %Y}) has passed, so this belated return "
                "must be filed under the new tax regime.",
            )
        )

    if not form_checked and comp.summary.total_income > rules.itr1_total_income_limit:
        issues.append(
            Issue(field=None, message="Total income is above Rs 50 lakh, so ITR-1 cannot be used. Use ITR-2.")
        )
    if comp.regime == "old" and comp.house_property_total < -rules.house_property_loss_setoff_cap:
        issues.append(
            Issue(
                field="house_properties",
                message="House property loss above Rs 2 lakh must be carried forward, which needs ITR-2.",
            )
        )
    return issues


def _require(issues: list[Issue], value: str | None, field: str, label: str, pattern: re.Pattern | None = None):
    if value is None or not value.strip():
        issues.append(Issue(field=field, message=f"{label} is required."))
    elif pattern is not None and not pattern.match(value.strip()):
        issues.append(Issue(field=field, message=f"{label} is not in a valid format."))


def missing_fields(
    draft: ItrDraftData, comp: ItrComputation, rules: ItrYearRules, form: str = "ITR-1"
) -> list[Issue]:
    issues: list[Issue] = []
    p = draft.personal
    a = p.address

    if draft.eligibility.is_resident is None:
        issues.append(Issue(field="eligibility.is_resident", message="Answer whether you were a resident."))

    _require(issues, p.last_name, "personal.last_name", "Last name")
    _require(issues, p.father_name, "personal.father_name", "Father's name")
    _require(issues, p.pan, "personal.pan", "PAN", PAN_RE)
    if p.aadhaar:
        _require(issues, p.aadhaar, "personal.aadhaar", "Aadhaar number", AADHAAR_RE)
    if p.date_of_birth is None:
        issues.append(Issue(field="personal.date_of_birth", message="Date of birth is required."))
    elif p.date_of_birth > rules.fy_end:
        issues.append(Issue(field="personal.date_of_birth", message="Date of birth is not valid."))
    _require(issues, p.mobile, "personal.mobile", "Mobile number", MOBILE_RE)
    _require(issues, p.email, "personal.email", "Email", EMAIL_RE)
    if p.employer_category is None:
        issues.append(Issue(field="personal.employer_category", message="Nature of employment is required."))
    elif p.employer_category == "NA" and comp.summary.gross_salary > 0:
        issues.append(
            Issue(
                field="personal.employer_category",
                message="Nature of employment cannot be 'Not applicable' when you have salary income.",
            )
        )

    _require(issues, a.flat_no, "personal.address.flat_no", "Flat / door no.")
    _require(issues, a.locality, "personal.address.locality", "Locality / area")
    _require(issues, a.city, "personal.address.city", "City")
    if a.state_code not in STATE_CODES:
        issues.append(Issue(field="personal.address.state_code", message="State is required."))
    _require(issues, a.pin_code, "personal.address.pin_code", "PIN code", PIN_RE)

    for i, emp in enumerate(draft.salary.employers):
        _require(issues, emp.name, f"salary.employers.{i}.name", f"Employer {i + 1} name")
        _require(issues, emp.tan, f"salary.employers.{i}.tan", f"Employer {i + 1} TAN", TAN_RE)
    if comp.summary.gross_salary > 0 and not draft.salary.employers:
        issues.append(Issue(field="salary.employers", message="Add your employer details from Form 16."))

    for i, prop in enumerate(draft.house_properties):
        label = f"House property {i + 1}"
        _require(issues, prop.address, f"house_properties.{i}.address", f"{label} address")
        _require(issues, prop.city, f"house_properties.{i}.city", f"{label} city")
        if prop.state_code not in STATE_CODES:
            issues.append(Issue(field=f"house_properties.{i}.state_code", message=f"{label} state is required."))
        if prop.property_type != "self_occupied" and prop.gross_rent <= 0:
            issues.append(
                Issue(field=f"house_properties.{i}.gross_rent", message=f"{label}: enter the rent or lettable value.")
            )
        if comp.properties[i].interest_allowed > 0:
            loan = prop.loan
            _require(issues, loan.lender_name, f"house_properties.{i}.loan.lender_name", f"{label} lender name")
            _require(
                issues, loan.account_no, f"house_properties.{i}.loan.account_no", f"{label} loan account no.",
                ACCOUNT_RE,
            )
            if loan.sanction_date is None:
                issues.append(
                    Issue(field=f"house_properties.{i}.loan.sanction_date", message=f"{label} loan date is required.")
                )

    if draft.other_income.other_amount > 0:
        _require(
            issues, draft.other_income.other_description, "other_income.other_description",
            "Description of other income",
        )

    d = draft.deductions
    if comp.regime == "old":
        for i, item in enumerate(d.section_80c):
            if item.amount > 0:
                _require(
                    issues, item.identification_no, f"deductions.section_80c.{i}.identification_no",
                    f"80C item {i + 1} policy / document number",
                )
        for bucket_name, bucket in (("health_self", d.health_self), ("health_parents", d.health_parents)):
            if not bucket.claiming:
                continue
            for i, policy in enumerate(bucket.policies):
                if policy.premium > 0:
                    _require(issues, policy.insurer, f"deductions.{bucket_name}.policies.{i}.insurer", "Insurer name")
                    _require(
                        issues, policy.policy_no, f"deductions.{bucket_name}.policies.{i}.policy_no", "Policy number"
                    )
    if comp.deductions.get("80CCD(1B)") or comp.deductions.get("80CCD(2)"):
        _require(issues, d.pran, "deductions.pran", "PRAN (NPS account number)", PRAN_RE)

    tp = draft.taxes_paid
    for i, tds in enumerate(tp.tds_other):
        _require(issues, tds.deductor_name, f"taxes_paid.tds_other.{i}.deductor_name", f"TDS {i + 1} deductor name")
        _require(issues, tds.tan, f"taxes_paid.tds_other.{i}.tan", f"TDS {i + 1} deductor TAN", TAN_RE)
        if tds.tds_claimed > tds.tds_deducted:
            issues.append(
                Issue(
                    field=f"taxes_paid.tds_other.{i}.tds_claimed",
                    message=f"TDS {i + 1}: amount claimed cannot be more than tax deducted.",
                )
            )
    for i, tcs in enumerate(tp.tcs):
        _require(issues, tcs.collector_name, f"taxes_paid.tcs.{i}.collector_name", f"TCS {i + 1} collector name")
        _require(issues, tcs.tan, f"taxes_paid.tcs.{i}.tan", f"TCS {i + 1} collector TAN", TAN_RE)
        if tcs.amount_claimed > tcs.amount_collected:
            issues.append(
                Issue(
                    field=f"taxes_paid.tcs.{i}.amount_claimed",
                    message=f"TCS {i + 1}: amount claimed cannot be more than tax collected.",
                )
            )
    for i, challan in enumerate(tp.challans):
        _require(issues, challan.bsr_code, f"taxes_paid.challans.{i}.bsr_code", f"Challan {i + 1} BSR code", BSR_RE)
        _require(
            issues, challan.challan_serial_no, f"taxes_paid.challans.{i}.challan_serial_no",
            f"Challan {i + 1} serial no.", re.compile(r"^[0-9]{1,5}$"),
        )
        if challan.date_of_deposit is None:
            issues.append(Issue(field=f"taxes_paid.challans.{i}.date_of_deposit", message="Challan date is required."))
        elif challan.date_of_deposit < rules.fy_start:
            issues.append(
                Issue(
                    field=f"taxes_paid.challans.{i}.date_of_deposit",
                    message=f"Challan {i + 1}: date must be on or after {rules.fy_start:%d %b %Y}.",
                )
            )

    if not draft.bank_accounts:
        issues.append(Issue(field="bank_accounts", message="Add at least one bank account."))
    for i, bank in enumerate(draft.bank_accounts):
        _require(issues, bank.ifsc, f"bank_accounts.{i}.ifsc", f"Bank {i + 1} IFSC", IFSC_RE)
        _require(issues, bank.bank_name, f"bank_accounts.{i}.bank_name", f"Bank {i + 1} name")
        _require(issues, bank.account_no, f"bank_accounts.{i}.account_no", f"Bank {i + 1} account number", ACCOUNT_RE)
    if draft.bank_accounts and sum(b.use_for_refund for b in draft.bank_accounts) != 1:
        issues.append(Issue(field="bank_accounts", message="Select exactly one bank account for the refund."))

    _require(issues, draft.verification_place, "verification_place", "Place (for verification)")

    if form in ("ITR-2", "ITR-3"):
        if p.pan and PAN_RE.match(p.pan.strip()) and p.pan.strip()[3] != "P":
            issues.append(Issue(
                field="personal.pan",
                message="This PAN isn't an individual's — the 4th character of an individual's PAN is 'P'.",
            ))
        if comp.summary.gross_salary > 0 and draft.salary.employers:
            emp = draft.salary.employers[0]
            _require(issues, emp.address, "salary.employers.0.address", "Employer address")
            _require(issues, emp.city, "salary.employers.0.city", "Employer city")
            if emp.state_code not in STATE_CODES:
                issues.append(Issue(field="salary.employers.0.state_code", message="Employer state is required."))
        for i, txn in enumerate(draft.capital_gains):
            label = f"Capital gain {i + 1}"
            _require(issues, txn.name, f"capital_gains.{i}.name", f"{label} name of share / fund")
            if txn.sale_date is None:
                issues.append(Issue(field=f"capital_gains.{i}.sale_date", message=f"{label}: sale date is required."))
            elif not (rules.fy_start <= txn.sale_date <= rules.fy_end):
                issues.append(Issue(
                    field=f"capital_gains.{i}.sale_date",
                    message=f"{label}: sale date must be within FY {rules.financial_year}.",
                ))
            if txn.asset_type != "debt_mf" and txn.term == "long":
                _require(issues, txn.isin, f"capital_gains.{i}.isin", f"{label} ISIN", ISIN_RE)
            if txn.sale_value <= 0:
                issues.append(Issue(field=f"capital_gains.{i}.sale_value", message=f"{label}: enter the sale value."))
    return issues


def warnings(draft: ItrDraftData, comp: ItrComputation, rules: ItrYearRules) -> list[str]:
    result = list(comp.notes)
    s = comp.summary
    p = draft.personal
    if s.gross_total_income == 0:
        result.append(
            "The total income in this return is zero. Check that you have entered your salary and interest income."
        )
    if p.pan and PAN_RE.match(p.pan.strip()) and p.last_name and p.last_name.strip():
        # For individuals, the 5th character of the PAN is the first letter of the surname.
        if p.pan.strip()[4] != p.last_name.strip()[0].upper():
            result.append(
                f"Your last name '{p.last_name.strip()}' doesn't match your PAN — its 5th character "
                f"('{p.pan.strip()[4]}') should be the first letter of your last name. Enter your name exactly as on PAN."
            )
    if s.gross_salary > 0 and not draft.salary.employers:
        result.append("You've entered salary but no employer. Add your employer's name, TAN and TDS from Form 16.")
    if s.balance_payable > 0:
        result.append(
            "You have tax payable. Pay it as self-assessment tax (Challan 280) before uploading, "
            "add the challan under Taxes paid, and download the file again."
        )
    if comp.filing_date > rules.due_date:
        result.append(
            "Interest u/s 234A/234B and the 234F fee are computed assuming you upload this return today. "
            "Download the file again if you upload in a later month."
        )
    tds_salary = sum(e.income_chargeable for e in draft.salary.employers)
    if draft.salary.employers and tds_salary != s.income_from_salary:
        result.append(
            "Income chargeable under salaries reported by your employers does not match the salary computed "
            "here — check it against Form 16 Part B."
        )
    if draft.regime == "new" and draft.deductions.section_80c:
        result.append("80C/80D and other old-regime deductions are ignored under the new regime.")
    return result
