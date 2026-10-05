"""
Builds the ITR-1 JSON in the exact structure of the official e-filing schema
(see `official/`) and validates it against that schema before it is handed
to the user for upload on incometax.gov.in.
"""

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft4Validator

from app.core.config import get_settings
from app.modules.itr.computation import HealthComputation, ItrComputation
from app.modules.itr.rules import ItrYearRules
from app.modules.itr.schemas import Health80DDraft, ItrDraftData

_OFFICIAL_DIR = Path(__file__).parent / "official"
_INDIA = "91"
_LET_OUT_CODES = {"let_out": "L", "deemed_let_out": "D", "self_occupied": "S"}


@lru_cache
def _validator(schema_file: str) -> Draft4Validator:
    schema = json.loads((_OFFICIAL_DIR / schema_file).read_text())
    return Draft4Validator(schema)


def schema_errors(itr: dict, rules: ItrYearRules) -> list[str]:
    errors = sorted(_validator(rules.schema_file).iter_errors(itr), key=lambda e: list(e.absolute_path))
    return [f"{'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}" for e in errors]


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _drop_none(obj: dict) -> dict:
    return {k: v for k, v in obj.items() if v is not None}


def _full_name(draft: ItrDraftData) -> str:
    p = draft.personal
    return " ".join(part.strip() for part in (p.first_name, p.middle_name, p.last_name) if part and part.strip())


def _personal_info(draft: ItrDraftData) -> dict:
    p = draft.personal
    a = p.address
    return _drop_none(
        {
            "AssesseeName": _drop_none(
                {
                    "FirstName": _clean(p.first_name),
                    "MiddleName": _clean(p.middle_name),
                    "SurNameOrOrgName": _clean(p.last_name),
                }
            ),
            "PAN": p.pan.strip().upper(),
            "Address": _drop_none(
                {
                    "ResidenceNo": _clean(a.flat_no),
                    "ResidenceName": _clean(a.building),
                    "RoadOrStreet": _clean(a.street),
                    "LocalityOrArea": _clean(a.locality),
                    "CityOrTownOrDistrict": _clean(a.city),
                    "StateCode": a.state_code,
                    "CountryCode": _INDIA,
                    "PinCode": int(a.pin_code),
                    "CountryCodeMobile": int(_INDIA),
                    "MobileNo": int(p.mobile),
                    "EmailAddress": p.email.strip(),
                }
            ),
            "SecondaryAdd": "N",
            "DOB": p.date_of_birth.isoformat(),
            "EmployerCategory": p.employer_category,
            "AadhaarCardNo": _clean(p.aadhaar),
        }
    )


def _exempt_allowances(draft: ItrDraftData, comp: ItrComputation) -> list[dict]:
    s = draft.salary
    rows = [("10(10)", s.gratuity_exemption), ("10(10AA)", s.leave_encashment_exemption)]
    if comp.regime == "old":
        rows.insert(0, ("10(13A)", comp.hra.exemption if comp.hra else 0))
        rows.insert(1, ("10(5)", min(s.lta_exemption, s.salary_17_1)))
    return [{"SalNatureDesc": code, "SalOthAmount": amount} for code, amount in rows if amount > 0]


def _properties(draft: ItrDraftData, comp: ItrComputation) -> list[dict]:
    result = []
    for prop, pc in zip(draft.house_properties, comp.properties):
        rent = {
            "AnnualLetableValue": pc.annual_value,
            "RentNotRealized": 0,
            "LocalTaxes": pc.local_taxes,
            "TotalUnrealizedAndTax": pc.local_taxes,
            "BalanceALV": pc.balance,
            "AnnualOfPropOwned": pc.balance,
            "ThirtyPercentOfBalance": pc.standard_deduction,
            "IntOnBorwCap": pc.interest_allowed,
            "TotalDeduct": pc.standard_deduction + pc.interest_allowed,
            "ArrearsUnrealizedRentRcvd": 0,
            "IncomeOfHP": pc.income,
        }
        if pc.interest_allowed > 0:
            loan = prop.loan
            rent["Section24B"] = {
                "Section24BDtls": [
                    {
                        "LoanTknFrom": loan.lender_type,
                        "BankOrInstnName": loan.lender_name.strip(),
                        "LoanAccNoOfBankOrInstnRefNo": loan.account_no.strip(),
                        "DateofLoan": loan.sanction_date.isoformat(),
                        "TotalLoanAmt": loan.total_amount,
                        "LoanOutstndngAmt": loan.outstanding_amount,
                        "InterestUs24B": pc.interest_allowed,
                    }
                ],
                "TotalInterestUs24B": pc.interest_allowed,
            }
        item = {
            "HPSNo": pc.index,
            "AddressDetailWithZipCode": _drop_none(
                {
                    "AddrDetail": prop.address.strip(),
                    "CityOrTownOrDistrict": prop.city.strip(),
                    "StateCode": prop.state_code,
                    "CountryCode": _INDIA,
                    "PinCode": int(prop.pin_code) if prop.pin_code else None,
                }
            ),
            "PropertyOwner": "SE",
            "PropCoOwnedFlg": "NO",
            "ifLetOut": _LET_OUT_CODES[prop.property_type],
            "Rentdetails": rent,
        }
        if prop.property_type == "let_out" and _clean(prop.tenant_name):
            item["TenantDetails"] = [{"TenantSNo": 1, "NameofTenant": prop.tenant_name.strip()}]
        result.append(item)
    return result


def _other_sources(draft: ItrDraftData) -> list[dict]:
    o = draft.other_income
    rows = [
        {"OthSrcNatureDesc": "SAV", "OthSrcOthAmount": o.savings_interest},
        {"OthSrcNatureDesc": "IFD", "OthSrcOthAmount": o.deposit_interest},
        {"OthSrcNatureDesc": "TAX", "OthSrcOthAmount": o.refund_interest},
        {"OthSrcNatureDesc": "FAP", "OthSrcOthAmount": o.family_pension},
        {
            "OthSrcNatureDesc": "DIV",
            "OthSrcOthAmount": o.dividends.total,
            "DividendInc": {
                "DateRange": {
                    "Upto15Of6": o.dividends.upto_15_jun,
                    "Upto15Of9": o.dividends.jun_16_to_sep_15,
                    "Up16Of9To15Of12": o.dividends.sep_16_to_dec_15,
                    "Up16Of12To15Of3": o.dividends.dec_16_to_mar_15,
                    "Up16Of3To31Of3": o.dividends.mar_16_to_mar_31,
                }
            },
        },
        {
            "OthSrcNatureDesc": "OTH",
            "OthSrcOthNatOfInc": _clean(o.other_description),
            "OthSrcOthAmount": o.other_amount,
        },
    ]
    return [_drop_none(r) for r in rows if r["OthSrcOthAmount"] > 0]


_VIA_SECTIONS = [
    "Section80C", "Section80CCC", "Section80CCDEmployeeOrSE", "Section80CCD1B", "Section80CCDEmployer",
    "Section80D", "Section80DD", "Section80DDB", "Section80E", "Section80EE", "Section80EEA", "Section80EEB",
    "Section80G", "Section80GG", "Section80GGA", "Section80GGC", "Section80U", "Section80TTA", "Section80TTB",
    "AnyOthSec80CCH",
]
_SECTION_KEYS = {
    "80C": "Section80C",
    "80CCD(1B)": "Section80CCD1B",
    "80CCD(2)": "Section80CCDEmployer",
    "80D": "Section80D",
    "80TTA": "Section80TTA",
    "80TTB": "Section80TTB",
}


def _chapter_via(draft: ItrDraftData, comp: ItrComputation) -> tuple[dict, dict]:
    allowed = dict.fromkeys(_VIA_SECTIONS, 0)
    for section, amount in comp.deductions.items():
        allowed[_SECTION_KEYS[section]] = amount
    allowed["TotalChapVIADeductions"] = sum(comp.deductions.values())

    claimed = {k: v for k, v in allowed.items() if k != "TotalChapVIADeductions"}
    claimed.pop("Section80EEA")
    claimed.pop("Section80EEB")
    if comp.regime == "old":
        # User-enterable amounts (before caps); the eligible amount can never exceed these.
        d = draft.deductions
        claimed["Section80C"] = max(allowed["Section80C"], sum(i.amount for i in d.section_80c))
        claimed["Section80CCD1B"] = max(allowed["Section80CCD1B"], d.section_80ccd_1b)
        claimed["Section80CCDEmployer"] = max(allowed["Section80CCDEmployer"], d.section_80ccd_2)
    elif draft.deductions.section_80ccd_2:
        claimed["Section80CCDEmployer"] = max(allowed["Section80CCDEmployer"], draft.deductions.section_80ccd_2)
    claimed["TotalChapVIADeductions"] = sum(claimed.values())
    if allowed["Section80CCD1B"] or allowed["Section80CCDEmployer"]:
        claimed["PRANDtls"] = [{"PRANNum": draft.deductions.pran.strip()}]
    return claimed, allowed


def _health_details(bucket: Health80DDraft) -> dict:
    policies = [p for p in bucket.policies if p.premium > 0]
    return {
        "Sch80DInsDtls": [
            {"InsurerName": p.insurer.strip(), "PolicyNo": p.policy_no.strip(), "HealthInsAmt": p.premium}
            for p in policies
        ],
        "TotalPayments": sum(p.premium for p in policies),
    }


def _schedule_80d(draft: ItrDraftData, comp: ItrComputation) -> dict | None:
    d = draft.deductions
    if comp.deductions.get("80D", 0) <= 0:
        return None

    def bucket(draft_bucket: Health80DDraft, hc: HealthComputation, normal: tuple, senior: tuple) -> dict:
        deduction_key, premium_key, details_key, preventive_key, *medical_key = (
            senior if draft_bucket.includes_senior_citizen else normal
        )
        out = {
            deduction_key: hc.deduction,
            premium_key: hc.insurance,
            preventive_key: hc.preventive,
        }
        if hc.insurance > 0:
            out[details_key] = _health_details(draft_bucket)
        if medical_key:
            out[medical_key[0]] = hc.medical
        return out

    health = {
        "SeniorCitizenFlag": ("Y" if d.health_self.includes_senior_citizen else "N") if d.health_self.claiming else "S",
        "ParentsSeniorCitizenFlag": (
            ("Y" if d.health_parents.includes_senior_citizen else "N") if d.health_parents.claiming else "P"
        ),
        "EligibleAmountOfDedn": comp.deductions["80D"],
    }
    if d.health_self.claiming:
        health |= bucket(
            d.health_self,
            comp.health_self,
            ("SelfAndFamily", "HealthInsPremSlfFam", "Sec80DSelfFamHIDtls", "PrevHlthChckUpSlfFam"),
            (
                "SelfAndFamilySeniorCitizen", "HlthInsPremSlfFamSrCtzn", "Sec80DSelfFamSrCtznHIDtls",
                "PrevHlthChckUpSlfFamSrCtzn", "MedicalExpSlfFamSrCtzn",
            ),
        )
    if d.health_parents.claiming:
        health |= bucket(
            d.health_parents,
            comp.health_parents,
            ("Parents", "HlthInsPremParents", "Sec80DParentsHIDtls", "PrevHlthChckUpParents"),
            (
                "ParentsSeniorCitizen", "HlthInsPremParentsSrCtzn", "Sec80DParentsSrCtznHIDtls",
                "PrevHlthChckUpParentsSrCtzn", "MedicalExpParentsSrCtzn",
            ),
        )
    return {"Sec80DSelfFamSrCtznHealth": health}


def _deductor(name: str, tan: str) -> dict:
    return {"TAN": tan.strip().upper(), "EmployerOrDeductorOrCollecterName": name.strip()}


def build_itr_json(draft: ItrDraftData, comp: ItrComputation, rules: ItrYearRules) -> dict:
    settings = get_settings()
    s = comp.summary
    sal = draft.salary
    tp = draft.taxes_paid

    exempt_rows = _exempt_allowances(draft, comp)
    allowances = {"TotalAllwncExemptUs10": s.exempt_allowances}
    if exempt_rows:
        allowances["AllwncExemptUs10Dtls"] = exempt_rows
    claimed_via, allowed_via = _chapter_via(draft, comp)

    income = {
        "GrossSalary": s.gross_salary,
        "Salary": sal.salary_17_1,
        "PerquisitesValue": sal.perquisites_17_2,
        "ProfitsInSalary": sal.profits_17_3,
        "AllwncExemptUs10": allowances,
        "NetSalary": s.net_salary,
        "DeductionUs16": s.standard_deduction + s.professional_tax,
        "DeductionUs16ia": s.standard_deduction,
        "EntertainmentAlw16ii": 0,
        "ProfessionalTaxUs16iii": s.professional_tax,
        "IncomeFromSal": s.income_from_salary,
        "IncomeOthSrc": s.income_from_other_sources,
        "DeductionUs57iia": s.family_pension_deduction,
        "GrossTotIncome": s.gross_total_income,
        "GrossTotIncomeIncLTCG112A": s.gross_total_income,
        "UsrDeductUndChapVIA": claimed_via,
        "DeductUndChapVIA": allowed_via,
        "TotalIncome": s.total_income,
    }
    if draft.house_properties:
        income["PropertyDetails"] = _properties(draft, comp)
        income["TotalIncomeChargeableUnHP"] = s.income_from_house_property
    other_rows = _other_sources(draft)
    if other_rows:
        income["OthersInc"] = {"OthersIncDtlsOthSrc": other_rows}

    total_interest = s.interest_234a + s.interest_234b + s.interest_234c + s.fee_234f
    banks = [
        {
            "IFSCCode": b.ifsc.strip().upper(),
            "BankName": b.bank_name.strip(),
            "BankAccountNo": b.account_no.strip(),
            "AccountType": b.account_type,
            "UseForRefund": "true" if b.use_for_refund else "false",
        }
        for b in draft.bank_accounts
    ]

    itr1: dict = {
        "CreationInfo": {
            "SWVersionNo": settings.itr_software_version,
            "SWCreatedBy": settings.itr_software_id,
            "JSONCreatedBy": settings.itr_software_id,
            "JSONCreationDate": comp.filing_date.isoformat(),
            "IntermediaryCity": draft.verification_place.strip(),
            "Digest": "-",
        },
        "Form_ITR1": {
            "FormName": "ITR-1",
            "Description": "For Indls having Income from Salary, Pension, family pension and Interest",
            "AssessmentYear": rules.schema_assessment_year,
            "SchemaVer": rules.schema_version,
            "FormVer": rules.form_version,
        },
        "PersonalInfo": _personal_info(draft),
        "FilingStatus": {
            "ReturnFileSec": 11 if comp.filing_date <= rules.due_date else 12,
            "OptOutNewTaxRegime": "Y" if comp.regime == "old" else "N",
            "SeventhProvisio139": "N",
            "AsseseeRepFlg": "N",
            "ItrFilingDueDate": rules.due_date.isoformat(),
        },
        "ITR1_IncomeDeductions": income,
        "ITR1_TaxComputation": {
            "TotalTaxPayable": s.tax_on_total_income,
            "Rebate87A": s.rebate_87a,
            "TaxPayableOnRebate": s.tax_after_rebate,
            "EducationCess": s.cess,
            "GrossTaxLiability": s.gross_tax_liability,
            "Section89": 0,
            "NetTaxLiability": s.gross_tax_liability,
            "TotalIntrstPay": total_interest,
            "IntrstPay": {
                "IntrstPayUs234A": s.interest_234a,
                "IntrstPayUs234B": s.interest_234b,
                "IntrstPayUs234C": s.interest_234c,
                "LateFilingFee234F": s.fee_234f,
            },
            "TotTaxPlusIntrstPay": s.total_tax_and_interest,
        },
        "TaxPaid": {
            "TaxesPaid": {
                "AdvanceTax": s.advance_tax,
                "TDS": s.tds,
                "TCS": s.tcs,
                "SelfAssessmentTax": s.self_assessment_tax,
                "TotalTaxesPaid": s.total_taxes_paid,
            },
            "BalTaxPayable": s.balance_payable,
        },
        "Refund": {"RefundDue": s.refund_due, "BankAccountDtls": {"AddtnlBankDetails": banks}},
        "Verification": {
            "Declaration": {
                "AssesseeVerName": _full_name(draft),
                "FatherName": draft.personal.father_name.strip(),
                "AssesseeVerPAN": draft.personal.pan.strip().upper(),
            },
            "Capacity": "S",
            "Place": draft.verification_place.strip(),
        },
    }

    if comp.regime == "old":
        items_80c = [i for i in draft.deductions.section_80c if i.amount > 0]
        if items_80c:
            itr1["Schedule80C"] = {
                "Schedule80CDtls": [
                    {"IdentificationNo": i.identification_no.strip(), "Amount": i.amount} for i in items_80c
                ],
                "TotalAmt": sum(i.amount for i in items_80c),
            }
        schedule_80d = _schedule_80d(draft, comp)
        if schedule_80d:
            itr1["Schedule80D"] = schedule_80d
        if comp.hra and comp.hra.exemption > 0:
            h = comp.hra
            itr1["ScheduleEA10_13A"] = {
                "Placeofwork": "1" if sal.hra.is_metro else "2",
                "ActlHRARecv": h.hra_received,
                "ActlRentPaid": h.rent_paid,
                "DtlsSalUsSec171": sal.salary_17_1,
                "BasicSalary": sal.hra.basic_salary,
                "DearnessAllwnc": sal.hra.dearness_allowance,
                "ActlRentPaid10Per": h.rent_minus_10_percent,
                "Sal40Or50Per": h.percent_of_salary,
                "EligbleExmpAllwncUs13A": h.exemption,
            }

    employers = sal.employers
    itr1["TDSonSalaries"] = {"TotalTDSonSalaries": sum(e.tds for e in employers)}
    if employers:
        itr1["TDSonSalaries"]["TDSonSalary"] = [
            {
                "EmployerOrDeductorOrCollectDetl": _deductor(e.name, e.tan),
                "IncChrgSal": e.income_chargeable,
                "TotalTDSSal": e.tds,
            }
            for e in employers
        ]
    itr1["TDSonOthThanSals"] = {"TotalTDSonOthThanSals": sum(t.tds_claimed for t in tp.tds_other)}
    if tp.tds_other:
        itr1["TDSonOthThanSals"]["TDSonOthThanSal"] = [
            {
                "EmployerOrDeductorOrCollectDetl": _deductor(t.deductor_name, t.tan),
                "TDSSection": t.section,
                "AmtForTaxDeduct": t.amount_paid,
                "DeductedYr": t.deducted_year,
                "TotTDSOnAmtPaid": t.tds_deducted,
                "ClaimOutOfTotTDSOnAmtPaid": t.tds_claimed,
            }
            for t in tp.tds_other
        ]
    itr1["ScheduleTCS"] = {"TotalSchTCS": s.tcs}
    if tp.tcs:
        itr1["ScheduleTCS"]["TCS"] = [
            {
                "EmployerOrDeductorOrCollectDetl": _deductor(t.collector_name, t.tan),
                "AmtTaxCollected": t.amount_collected,
                "CollectedYr": str(rules.fy_start.year),
                "TotalTCS": t.amount_collected,
                "AmtTCSClaimedThisYear": t.amount_claimed,
            }
            for t in tp.tcs
        ]
    challans = [c for c in tp.challans if c.amount > 0 and c.date_of_deposit]
    itr1["TaxPayments"] = {"TotalTaxPayments": sum(c.amount for c in challans)}
    if challans:
        itr1["TaxPayments"]["TaxPayment"] = [
            {
                "BSRCode": c.bsr_code.strip().upper(),
                "DateDep": c.date_of_deposit.isoformat(),
                "SrlNoOfChaln": int(c.challan_serial_no),
                "Amt": c.amount,
            }
            for c in challans
        ]

    return {"ITR": {"ITR1": itr1}}


def file_name(draft: ItrDraftData, rules: ItrYearRules) -> str:
    return f"ITR1_AY{rules.assessment_year}_{draft.personal.pan.strip().upper()}.json"
