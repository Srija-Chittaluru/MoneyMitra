"""
ITR-2 and ITR-3 JSON builders.

Both start from the schema skeleton (every mandatory field, numbers at 0) and
fill in the taxpayer's data:
- ITR-2: salary, other sources, capital gains on listed shares / equity funds
  (111A, 112A) and debt funds (50AA), set-off, tax at special rates, TDS.
- ITR-3: everything in ITR-2 plus share trading as business income without
  books of account — intraday (speculative, code 21009) and F&O
  (non-speculative, code 21010).
Scope limits are enforced by the form selector (no house property, foreign
assets, income above Rs 50 lakh or old regime yet).
"""

from datetime import date
from decimal import Decimal

from app.core.config import get_settings
from app.modules.itr.computation import ItrComputation, bucket, txn_gain
from app.modules.itr.rules import ItrYearRules
from app.modules.itr.schema_tools import complete_form, merge, prune_none, schema_errors, section_skeleton
from app.modules.itr.schemas import ItrDraftData

SCHEMAS = {"ITR-2": "ITR-2_AY2026-27_V1.2.json", "ITR-3": "ITR-3_AY2026-27_V1.1.json"}
_INDIA = "91"
_QUARTERS = ["Upto15Of6", "Upto15Of9", "Up16Of9To15Of12", "Up16Of12To15Of3", "Up16Of3To31Of3"]
# ITR-3 names the second quarter differently in Schedule OS date ranges
# (Schedule CG keeps "Upto15Of9" in both forms).
_ITR3_QUARTER_NAMES = {"Upto15Of9": "Up16Of6To15Of9"}


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _quarter(day: date | None) -> str:
    if day is None:
        return _QUARTERS[-1]
    fy_month = (day.month - 4) % 12
    for (month, dom), key in zip([(6, 15), (9, 15), (12, 15), (3, 15)], _QUARTERS):
        limit = (month - 4) % 12
        if fy_month < limit or (fy_month == limit and day.day <= dom):
            return key
    return _QUARTERS[-1]


def _date_range(amounts: dict[str, int], form: str = "ITR-2") -> dict:
    names = _ITR3_QUARTER_NAMES if form == "ITR-3" else {}
    return {"DateRange": {names.get(q, q): max(0, amounts.get(q, 0)) for q in _QUARTERS}}


def _personal(draft: ItrDraftData) -> dict:
    p, a = draft.personal, draft.personal.address
    return prune_none({
        "AssesseeName": {
            "FirstName": _clean(p.first_name),
            "MiddleName": _clean(p.middle_name),
            "SurNameOrOrgName": _clean(p.last_name),
        },
        "PAN": p.pan.strip().upper(),
        "Address": {
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
        },
        "SecondaryAdd": "N",
        "DOB": p.date_of_birth.isoformat(),
        "Status": "I",
        "AadhaarCardNo": _clean(p.aadhaar),
    })


def _filing_status(comp: ItrComputation, rules: ItrYearRules, form: str) -> dict:
    status = {
        "ReturnFileSec": 11 if comp.filing_date <= rules.due_date else 12,
        "SeventhProvisio139": "N",
        "ResidentialStatus": "RES",
        "HeldUnlistedEqShrPrYrFlg": "N",
        "FiiFpiFlag": "N",
        "AsseseeRepFlg": "N",
        "CompDirectorPrvYrFlg": "N",
        "ItrFilingDueDate": rules.due_date.isoformat(),
    }
    if form == "ITR-2":
        status["OptOutNewTaxRegime"] = "Y" if comp.regime == "old" else "N"
    else:
        status.update({"IncFrmBusOrProf": "Y", "ForeignExchangeFlag": "N", "OptOldRegimeCurrAY": "N"})
    return status


def _salary_schedule(draft: ItrDraftData, comp: ItrComputation) -> dict | None:
    s = comp.summary
    if s.gross_salary <= 0:
        return None
    sal = draft.salary
    employer = sal.employers[0]
    exempt = [
        {"SalNatureDesc": code, "SalOthAmount": amount}
        for code, amount in (("10(10)", sal.gratuity_exemption), ("10(10AA)", sal.leave_encashment_exemption))
        if amount > 0
    ]
    schedule = {
        "Salaries": [prune_none({
            "NameOfEmployer": employer.name.strip(),
            "NatureOfEmployment": draft.personal.employer_category,
            "TANofEmployer": _clean(employer.tan),
            "AddressDetail": {
                "AddrDetail": employer.address.strip(),
                "CityOrTownOrDistrict": employer.city.strip(),
                "StateCode": employer.state_code,
                "PinCode": int(employer.pin_code) if employer.pin_code else None,
            },
            "Salarys": {
                "GrossSalary": s.gross_salary,
                "Salary": sal.salary_17_1,
                "ValueOfPerquisites": sal.perquisites_17_2,
                "ProfitsinLieuOfSalary": sal.profits_17_3,
                "IncomeNotified89A": 0,
                "IncomeNotifiedOther89A": 0,
            },
        })],
        "TotalGrossSalary": s.gross_salary,
        "AllwncExtentExemptUs10": s.exempt_allowances,
        "NetSalary": s.net_salary,
        "DeductionUS16": s.standard_deduction + s.professional_tax,
        "DeductionUnderSection16ia": s.standard_deduction,
        "EntertainmntalwncUs16ii": 0,
        "ProfessionalTaxUs16iii": s.professional_tax,
        "TotIncUnderHeadSalaries": s.income_from_salary,
    }
    if exempt:
        schedule["AllwncExemptUs10"] = {"AllwncExemptUs10Dtls": exempt}
    return schedule


def _other_sources_schedule(draft: ItrDraftData, comp: ItrComputation, schema_file: str, form: str) -> dict:
    o = draft.other_income
    s = comp.summary
    interest = o.savings_interest + o.deposit_interest + o.refund_interest
    gross = interest + o.dividends.total + o.family_pension + o.other_amount
    base = section_skeleton(schema_file, "ScheduleOS")
    inc = {
        "GrossIncChrgblTaxAtAppRate": gross,
        "DividendGross": o.dividends.total,
        "InterestGross": interest,
        "IntrstFrmSavingBank": o.savings_interest,
        "IntrstFrmTermDeposit": o.deposit_interest,
        "IntrstFrmIncmTaxRefund": o.refund_interest,
        "FamilyPension": o.family_pension,
        "AnyOtherIncome": o.other_amount,
        "Deductions": {
            "Expenses": 0,
            "DeductionUs57iia": s.family_pension_deduction,
            "Depreciation": 0,
            "TotDeductions": s.family_pension_deduction,
        },
        "BalanceNoRaceHorse": gross - s.family_pension_deduction,
    }
    if o.other_amount:
        inc["OthersInc"] = {"OthersIncDtls": [
            {"OthNatOfInc": (o.other_description or "Other income")[:125], "OthAmount": o.other_amount}
        ]}
    return merge(base, {
        "IncOthThanOwnRaceHorse": inc,
        "TotOthSrcNoRaceHorse": gross - s.family_pension_deduction,
        "IncChargeable": s.income_from_other_sources,
        # Dividends by date received (used for interest u/s 234C).
        "DividendIncUs115BBDA": _date_range({}, form),
    })


def _cg_schedules(draft: ItrDraftData, comp: ItrComputation, schema_file: str, form: str) -> dict:
    before_key = "LTCGBeforelower6and11" if form == "ITR-3" else "LTCGBeforelowerB1B2"
    cg = comp.capital_gains
    totals = {"stcg_111a": [0, 0, 0], "stcg_slab": [0, 0, 0]}  # sale, cost, expenses
    by_quarter: dict[str, dict[str, int]] = {"stcg_111a": {}, "stcg_slab": {}, "ltcg_112a": {}}
    rows_112a = []
    for txn in draft.capital_gains:
        b = bucket(txn)
        gain = txn_gain(txn)
        q = _quarter(txn.sale_date)
        by_quarter[b][q] = by_quarter[b].get(q, 0) + gain
        if b in totals:
            totals[b][0] += txn.sale_value
            totals[b][1] += txn.cost
            totals[b][2] += txn.expenses
            continue
        before = txn.acquired_before_feb_2018
        acquisition = txn.sale_value - txn.expenses - gain
        rows_112a.append({
            "ShareOnOrBefore": "BE" if before else "AE",
            "ISINCode": txn.isin.strip().upper(),
            "ShareUnitName": txn.name.strip()[:125],
            "NumSharesUnits": txn.quantity,
            "SalePricePerShareUnit": round(txn.sale_value / txn.quantity, 2) if txn.quantity else 0,
            "TotSaleValue": txn.sale_value,
            "CostAcqWithoutIndx": txn.cost,
            "AcquisitionCost": acquisition,
            before_key: max(0, txn.sale_value - txn.cost) if before else 0,
            "FairMktValuePerShareunit": round(txn.fmv_31_jan_2018 / txn.quantity, 2)
            if before and txn.quantity else 0,
            "TotFairMktValueCapAst": txn.fmv_31_jan_2018 if before else 0,
            "ExpExclCnctTransfer": txn.expenses,
            "TotalDeductions": acquisition + txn.expenses,
            "Balance": gain,
        })

    def sum_key(key: str) -> int:
        return sum(r[key] for r in rows_112a)

    schedule_112a = None
    if rows_112a:
        schedule_112a = {
            "Schedule112ADtls": rows_112a,
            "SaleValue112A": sum_key("TotSaleValue"),
            "CostAcqWithoutIndx112A": sum_key("CostAcqWithoutIndx"),
            "AcquisitionCost112A": int(sum(r["AcquisitionCost"] for r in rows_112a)),
            "LTCGBeforelowerB1B2112A": sum_key(before_key),
            "FairMktValueCapAst112A": sum_key("TotFairMktValueCapAst"),
            "ExpExclCnctTransfer112A": int(sum(r["ExpExclCnctTransfer"] for r in rows_112a)),
            "Deductions112A": sum_key("TotalDeductions"),
            "Balance112A": sum_key("Balance"),
        }
        if form == "ITR-2":
            schedule_112a["TotalBalance112A"] = sum_key("Balance")

    def sec48(sale: int, cost: int, expenses: int, gain: int) -> dict:
        return {
            "FullConsideration": sale,
            "DeductSec48": {"AquisitCost": cost, "ImproveCost": 0, "ExpOnTrans": expenses,
                            "TotalDedn": cost + expenses},
            "BalanceCG": gain,
            "LossSec94of7Or94of8": 0,
            "CapgainonAssets": gain,
        }

    sale, cost, exp = totals["stcg_111a"]
    short = {"TotalSTCG": cg.gross_stcg_111a + cg.gross_stcg_slab}
    if sale:
        short["EquityMFonSTT"] = [{"MFSectionCode": "1A", "EquityMFonSTTDtls": sec48(sale, cost, exp, cg.gross_stcg_111a)}]
    sale, cost, exp = totals["stcg_slab"]
    if sale:
        short["SaleOnOtherAssets"] = {
            "FullValueConsdRecvUnqshr": 0, "FairMrktValueUnqshr": 0, "FullValueConsdSec50CA": 0,
            "FullValueConsdOthUnqshr": sale, **sec48(sale, cost, exp, cg.gross_stcg_slab),
        }
    long = {
        "SaleOfEquityShareUs112A": {"BalanceCG": cg.gross_ltcg_112a, "DeductionUs54F": 0,
                                    "CapgainonAssets": cg.gross_ltcg_112a},
        "TotalLTCG": cg.gross_ltcg_112a,
    }

    # Current-year capital loss set-off (Schedule CG, part D).
    after = {"stcg_111a": cg.stcg_111a, "stcg_slab": cg.stcg_slab, "ltcg_112a": cg.ltcg_112a}
    from_slab_into = {"stcg_111a": 0, "ltcg_112a": 0}
    from_111a_into = {"stcg_slab": 0, "ltcg_112a": 0}
    remaining = cg.stcl_set_off_slab
    for key in ("stcg_111a", "ltcg_112a"):
        gross = max(0, {"stcg_111a": cg.gross_stcg_111a, "ltcg_112a": cg.gross_ltcg_112a}[key])
        used = min(remaining, gross)
        from_slab_into[key] = used
        remaining -= used
    remaining = cg.stcl_set_off_111a
    for key in ("stcg_slab", "ltcg_112a"):
        gross = max(0, {"stcg_slab": cg.gross_stcg_slab, "ltcg_112a": cg.gross_ltcg_112a - from_slab_into["ltcg_112a"]}[key])
        used = min(remaining, gross)
        from_111a_into[key] = used
        remaining -= used

    curr_losses = {
        "InLossSetOff": {
            "StclSetoff20Per": max(0, -cg.gross_stcg_111a), "StclSetoff30Per": 0,
            "StclSetoffAppRate": max(0, -cg.gross_stcg_slab), "StclSetoffDTAARate": 0,
            "LtclSetOff12_5Per": max(0, -cg.gross_ltcg_112a), "LtclSetOffDTAARate": 0,
        },
        "InStcg20Per": {"CurrYearIncome": max(0, cg.gross_stcg_111a), "StclSetoff30Per": 0,
                        "StclSetoffAppRate": from_slab_into["stcg_111a"], "StclSetoffDTAARate": 0,
                        "CurrYrCapGain": after["stcg_111a"]},
        "InStcgAppRate": {"CurrYearIncome": max(0, cg.gross_stcg_slab), "StclSetoff20Per": from_111a_into["stcg_slab"],
                          "StclSetoff30Per": 0, "StclSetoffDTAARate": 0, "CurrYrCapGain": after["stcg_slab"]},
        "InLtcg12_5Per": {"CurrYearIncome": max(0, cg.gross_ltcg_112a), "StclSetoff20Per": from_111a_into["ltcg_112a"],
                          "StclSetoff30Per": 0, "StclSetoffAppRate": from_slab_into["ltcg_112a"],
                          "StclSetoffDTAARate": 0, "LtclSetOffDTAARate": 0, "CurrYrCapGain": after["ltcg_112a"]},
        "TotLossSetOff": {"StclSetoff20Per": cg.stcl_set_off_111a, "StclSetoff30Per": 0,
                          "StclSetoffAppRate": cg.stcl_set_off_slab, "StclSetoffDTAARate": 0,
                          "LtclSetOff12_5Per": 0, "LtclSetOffDTAARate": 0},
        "LossRemainSetOff": {
            "StclSetoff20Per": max(0, -cg.gross_stcg_111a) - cg.stcl_set_off_111a, "StclSetoff30Per": 0,
            "StclSetoffAppRate": max(0, -cg.gross_stcg_slab) - cg.stcl_set_off_slab, "StclSetoffDTAARate": 0,
            "LtclSetOff12_5Per": cg.ltcl_carried_forward, "LtclSetOffDTAARate": 0,
        },
    }

    def quarters_for(key: str) -> dict:
        """Gains after set-off, spread by quarter of sale (losses reduce the latest quarters)."""
        amounts = {q: max(0, v) for q, v in by_quarter[key].items()}
        excess = sum(amounts.values()) - after[key]
        for q in reversed(_QUARTERS):
            cut = min(excess, amounts.get(q, 0))
            if cut:
                amounts[q] -= cut
                excess -= cut
        return amounts

    total_cg = cg.stcg_111a + cg.stcg_slab + cg.ltcg_112a
    base = section_skeleton(schema_file, "ScheduleCGFor23")
    schedule_cg = merge(base, {
        "ShortTermCapGainFor23": short,
        "LongTermCapGain23": long,
        "SumOfCGIncm": total_cg,
        "TotScheduleCGFor23": total_cg,
        "CurrYrLosses": curr_losses,
        "AccruOrRecOfCG": {
            "ShortTermUnder20Per": _date_range(quarters_for("stcg_111a")),
            "ShortTermUnder30Per": _date_range({}),
            "ShortTermUnderAppRate": _date_range(quarters_for("stcg_slab")),
            "ShortTermUnderDTAARate": _date_range({}),
            "LongTermUnder12_5Per": _date_range(quarters_for("ltcg_112a")),
            "LongTermUnderDTAARate": _date_range({}),
        },
    })
    return {"ScheduleCGFor23": schedule_cg, "Schedule112A": schedule_112a}


def _special_income(comp: ItrComputation, rules: ItrYearRules) -> dict:
    s = comp.summary
    rows = []
    if s.stcg_111a:
        rows.append({"SecCode": "1A", "SplRatePercent": 20, "SplRateInc": s.stcg_111a,
                     "SplRateIncTax": int(Decimal(s.stcg_111a) * rules.stcg_111a_rate)})
    if s.ltcg_112a:
        taxable = max(0, s.ltcg_112a - int(rules.ltcg_112a_exemption))
        rows.append({"SecCode": "2A", "SplRatePercent": 12.5, "SplRateInc": s.ltcg_112a,
                     "SplRateIncTax": int(Decimal(taxable) * rules.ltcg_112a_rate)})
    out = {"TotSplRateInc": sum(r["SplRateInc"] for r in rows), "TotSplRateIncTax": s.tax_at_special_rates}
    if rows:
        out["SplCodeRateTax"] = rows
    return out


def _cyla_bfla(comp: ItrComputation, form: str, schema_file: str) -> dict:
    s = comp.summary
    heads = {
        "Salary": s.income_from_salary,
        "HP": s.income_from_house_property,
        "STCG20Per": s.stcg_111a,
        "STCG30Per": 0,
        "STCGAppRate": s.stcg_slab,
        "STCGDTAARate": 0,
        "LTCG12_5Per": s.ltcg_112a,
        "LTCGDTAARate": 0,
        "OthSrcExclRaceHorse": s.income_from_other_sources,
        "OthSrcRaceHorse": 0,
        "IncOSDTAA": 0,
    }
    if form == "ITR-3":
        heads.update({"BusProfExclSpecProf": s.business_income, "SpeculativeInc": s.speculative_income,
                      "SpecifiedInc": 0})
    cyla = merge(section_skeleton(schema_file, "ScheduleCYLA"), {
        k: {"IncCYLA": {"IncOfCurYrUnderThatHead": max(0, v), "IncOfCurYrAfterSetOff": max(0, v)}}
        for k, v in heads.items()
    })
    bfla_heads = {k: v for k, v in heads.items() if k not in ("SpecifiedInc",)}
    bfla = merge(section_skeleton(schema_file, "ScheduleBFLA"), {
        **{k: {"IncBFLA": {"IncOfCurYrUndHeadFromCYLA": max(0, v), "IncOfCurYrAfterSetOffBFLosses": max(0, v)}}
           for k, v in bfla_heads.items()},
        "IncomeOfCurrYrAftCYLABFLA": s.gross_total_income,
    })
    return {"ScheduleCYLA": cyla, "ScheduleBFLA": bfla}


def _deductions(comp: ItrComputation, draft: ItrDraftData, schema_file: str) -> dict:
    ccd2 = comp.deductions.get("80CCD(2)", 0)
    via = merge(section_skeleton(schema_file, "ScheduleVIA"), {
        "UsrDeductUndChapVIA": {"Section80CCDEmployer": max(ccd2, draft.deductions.section_80ccd_2),
                                "TotalChapVIADeductions": max(ccd2, draft.deductions.section_80ccd_2)},
        "DeductUndChapVIA": {"Section80CCDEmployer": ccd2, "TotalChapVIADeductions": ccd2},
    })
    if ccd2 and draft.deductions.pran:
        via["UsrDeductUndChapVIA"]["PRANDtls"] = [{"PRANNum": draft.deductions.pran.strip()}]
    return via


def _total_income(comp: ItrComputation, form: str, schema_file: str) -> dict:
    s = comp.summary
    special = s.stcg_111a + s.ltcg_112a
    short = s.stcg_111a + s.stcg_slab
    capital = {
        "ShortTerm": {"ShortTerm20Per": s.stcg_111a, "ShortTerm30Per": 0, "ShortTermAppRate": s.stcg_slab,
                      "ShortTermSplRateDTAA": 0, "TotalShortTerm": short},
        "LongTerm": {"LongTerm12_5Per": s.ltcg_112a, "LongTermSplRateDTAA": 0, "TotalLongTerm": s.ltcg_112a},
        "ShortTermLongTermTotal": short + s.ltcg_112a,
        "CapGains30Per115BBH": 0,
        "TotalCapGains": short + s.ltcg_112a,
    }
    total_ti = s.gross_total_income
    ti = {
        "Salaries": s.income_from_salary,
        "IncomeFromHP": max(0, s.income_from_house_property),
        "CapGain": capital,
        "IncFromOS": {"OtherSrcThanOwnRaceHorse": s.income_from_other_sources, "IncChargblSplRate": 0,
                      "FromOwnRaceHorse": 0, "TotIncFromOS": s.income_from_other_sources},
        "TotalTI": total_ti,
        "CurrentYearLoss": 0,
        "BalanceAfterSetoffLosses": total_ti,
        "BroughtFwdLossesSetoff": 0,
        "GrossTotalIncome": s.gross_total_income,
        "IncChargeTaxSplRate111A112": special,
        "TotalIncome": s.total_income,
        "IncChargeableTaxSplRates": special,
        "NetAgricultureIncomeOrOtherIncomeForRate": 0,
        "AggregateIncome": max(0, s.total_income - special),
        "LossesOfCurrentYearCarriedFwd": sum(s.losses_carried_forward.values()),
        "DeemedIncomeUs115JC": 0,
    }
    if form == "ITR-2":
        ti["DeductionsUnderScheduleVIA"] = s.chapter_via_deductions
    else:
        ti["ProfBusGain"] = {"ProfGainNoSpecBus": s.business_income, "ProfGainSpecBus": s.speculative_income,
                             "ProfGainSpecifiedBus": 0, "ProfIncome115BBF": 0, "TotProfBusGain": s.income_from_business}
        ti["DeductionsUndSchVIADtl"] = {"PartBchapterVIA": s.chapter_via_deductions, "PartCchapterVIA": 0,
                                        "TotDeductUndSchVIA": s.chapter_via_deductions}
        ti["DeductionsUnder10Aor10AA"] = 0
    return merge(section_skeleton(schema_file, "PartB-TI"), ti)


def _tax(draft: ItrDraftData, comp: ItrComputation, schema_file: str, form: str) -> dict:
    s = comp.summary
    interest_total = s.interest_234a + s.interest_234b + s.interest_234c + s.fee_234f
    banks = [
        {"IFSCCode": b.ifsc.strip().upper(), "BankName": b.bank_name.strip(), "BankAccountNo": b.account_no.strip(),
         "AccountType": b.account_type, "UseForRefund": "true" if b.use_for_refund else "false"}
        for b in draft.bank_accounts
    ]
    on_ti = {"TaxAtNormalRatesOnAggrInc": s.tax_at_normal_rates,
             "TaxAtSpecialRates": s.tax_at_special_rates, "RebateOnAgriInc": 0,
             "TaxPayableOnTotInc": s.tax_on_total_income}
    after_rebate = {
        "Rebate87A": s.rebate_87a,
        "TaxPayableOnRebate": s.tax_after_rebate,
        "TotalSurcharge": s.surcharge,
        "SurchargeOnAboveCrore": s.surcharge,
        "SurchargeOnAboveCroreBeforeMarginal": s.surcharge,
        "EducationCess": s.cess,
        "GrossTaxLiability": s.gross_tax_liability,
    }
    # ITR-3 nests the rebate/surcharge/cess lines inside TaxPayableOnTI.
    computation = {"TaxPayableOnTI": {**on_ti, **after_rebate}} if form == "ITR-3" else {
        "TaxPayableOnTI": on_ti, **after_rebate}
    return merge(section_skeleton(schema_file, "PartB_TTI"), {
        "ComputationOfTaxLiability": {
            **computation,
            "GrossTaxPayable": s.gross_tax_liability,
            "TaxPayAfterCreditUs115JD": s.gross_tax_liability,
            "TaxRelief": {"TotTaxRelief": 0},
            "NetTaxLiability": s.gross_tax_liability,
            "IntrstPay": {"IntrstPayUs234A": s.interest_234a, "IntrstPayUs234B": s.interest_234b,
                          "IntrstPayUs234C": s.interest_234c, "LateFilingFee234F": s.fee_234f,
                          "TotalIntrstPay": interest_total},
            "AggregateTaxInterestLiability": s.total_tax_and_interest,
        },
        "TaxPaid": {
            "TaxesPaid": {"AdvanceTax": s.advance_tax, "TDS": s.tds, "TCS": s.tcs,
                          "SelfAssessmentTax": s.self_assessment_tax, "TotalTaxesPaid": s.total_taxes_paid},
            "BalTaxPayable": s.balance_payable,
        },
        "Refund": {"RefundDue": s.refund_due,
                   "BankAccountDtls": {"BankDtlsFlag": "Y", "AddtnlBankDetails": banks}},
        "AssetOutIndiaFlag": "NO",
    })


def _taxes_paid_schedules(draft: ItrDraftData) -> dict:
    tp = draft.taxes_paid
    employers = draft.salary.employers
    out: dict = {
        "ScheduleTDS1": {"TotalTDSonSalaries": sum(e.tds for e in employers)},
        "ScheduleTDS2": {"TotalTDSonOthThanSals": sum(t.tds_claimed for t in tp.tds_other)},
        "ScheduleTCS": {"TotalSchTCS": sum(t.amount_claimed for t in tp.tcs)},
    }
    if employers:
        out["ScheduleTDS1"]["TDSonSalary"] = [
            {"EmployerOrDeductorOrCollectDetl": {"TAN": e.tan.strip().upper(),
                                                 "EmployerOrDeductorOrCollecterName": e.name.strip()},
             "IncChrgSal": e.income_chargeable, "TotalTDSSal": e.tds}
            for e in employers
        ]
    if tp.tds_other:
        out["ScheduleTDS2"]["TDSOthThanSalaryDtls"] = [
            {"TDSCreditName": "S", "TANOfDeductor": t.tan.strip().upper(), "TDSSection": t.section,
             "TaxDeductCreditDtls": {"TaxDeductedOwnHands": t.tds_deducted, "TaxClaimedOwnHands": t.tds_claimed},
             "GrossAmount": t.amount_paid, "HeadOfIncome": "OS", "AmtCarriedFwd": t.tds_deducted - t.tds_claimed}
            for t in tp.tds_other
        ]
    if tp.tcs:
        out["ScheduleTCS"]["TCS"] = [
            {"TCSCreditOwner": "1", "EmployerOrDeductorOrCollectTAN": t.tan.strip().upper(),
             "TCSCurrFYDtls": {"TCSAmtCollOwnHand": t.amount_collected, "TCSAmtCollSpouseOrOthrHand": 0},
             "TCSClaimedThisYearDtls": {"TCSAmtCollOwnHand": t.amount_claimed, "TCSAmtCollSpouseOrOthrHand": 0},
             "AmtCarriedFwd": t.amount_collected - t.amount_claimed}
            for t in tp.tcs
        ]
    challans = [c for c in tp.challans if c.amount > 0 and c.date_of_deposit]
    out["ScheduleIT"] = {"TotalTaxPayments": sum(c.amount for c in challans)}
    if challans:
        out["ScheduleIT"]["TaxPayment"] = [
            {"BSRCode": c.bsr_code.strip().upper(), "DateDep": c.date_of_deposit.isoformat(),
             "SrlNoOfChaln": int(c.challan_serial_no), "Amt": c.amount}
            for c in challans
        ]
    return out


def _business(draft: ItrDraftData, comp: ItrComputation, schema_file: str) -> dict:
    """ITR-3 Part A (no books of account) and Schedule BP for share trading."""
    t = draft.trading
    s = comp.summary
    fno_net = t.fno_profit - t.fno_expenses
    nature = []
    if t.speculative_turnover or t.speculative_profit:
        nature.append({"Code": "21009", "TradeName1": "Intraday share trading"})
    if t.fno_turnover or t.fno_profit:
        nature.append({"Code": "21010", "TradeName1": "Futures and options trading"})

    gen2 = merge(section_skeleton(schema_file, "PartA_GEN2"), {
        "AuditInfo": {"LiableSec44AAflg": "N", "IncDclrdUs": "N", "LiableSec44ABflg": "N",
                      "LiableSec92Eflg": "N", "AccountAuditFlag": "N"},
        "NatOfBus": {"NatureOfBusiness": nature},
    })
    pl = merge(section_skeleton(schema_file, "PARTA_PL"), {
        "NoBooksOfAccPL": {
            "GrossReceipt": t.fno_turnover, "GrsRcptAccPayeeOrBankMode": t.fno_turnover, "GrsRcptOtherMode": 0,
            "GrossProfit": t.fno_profit, "Expenses": t.fno_expenses, "NetProfit": fno_net,
            "GrossReceiptPrf": 0, "GrsRcptAccPayeeOrBankModePrf": 0, "GrsRcptOtherModePrf": 0,
            "GrossProfitPrf": 0, "ExpensesPrf": 0, "NetProfitPrf": 0, "TotBusinessProfession": fno_net,
        },
        "TurnverFrmSpecActivity": t.speculative_turnover,
        "GrossProfit": t.speculative_profit,
        "Expenditure": 0,
        "NetIncomeFrmSpecActivity": t.speculative_profit,
    })
    bp_base = section_skeleton(schema_file, "ITR3ScheduleBP")
    other = {
        "ProfBfrTaxPL": fno_net + t.speculative_profit,
        "NetPLFromSpecBus": t.speculative_profit,
        "BalancePLOthThanSpecBus": fno_net,
        "AdjustedPLOthThanSpecBus": fno_net,
        "AdjustPLAfterDeprOthSpecInc": fno_net,
        "TotAfterAddToPLDeprOthSpecInc": fno_net,
        "PLAftAdjDedBusOthThanSpec": fno_net,
        "NetPLAftAdjBusOthThanSpec": fno_net,
        "NetPLBusOthThanSpec7A7B7C": fno_net,
        "IncomeOtherThanRule": fno_net,
    }
    bp = merge(bp_base, {
        "BusinessIncOthThanSpec": other,
        "SpecBusinessInc": {"NetPLFrmSpecBus": t.speculative_profit, "AdditionUs28to44DA": 0,
                            "DeductUs28to44DA": 0, "AdjustedPLFrmSpecuBus": t.speculative_profit},
        "IncChrgUnHdProftGain": s.income_from_business,
        "BusSetoffCurrYr": {
            "LossSetOffOnBusLoss": 0,
            "SpeculativeInc": {"IncOfCurYrUnderThatHead": max(0, t.speculative_profit),
                               "BusLossSetoff": max(0, t.speculative_profit) - s.speculative_income,
                               "IncOfCurYrAfterSetOff": s.speculative_income},
            "TotLossSetOffOnBus": max(0, t.speculative_profit) - s.speculative_income,
            "LossRemainSetOffOnBus": s.losses_carried_forward.get("business_loss", 0),
        },
    })
    return {"PartA_GEN2": gen2, "PARTA_PL": pl, "ITR3ScheduleBP": bp}


def build_itr23_json(draft: ItrDraftData, comp: ItrComputation, rules: ItrYearRules, form: str) -> dict:
    settings = get_settings()
    schema_file = SCHEMAS[form]
    key = form.replace("-", "")
    p = draft.personal
    full_name = " ".join(x.strip() for x in (p.first_name, p.middle_name, p.last_name) if x and x.strip())

    body: dict = {
        "CreationInfo": {
            "SWVersionNo": settings.itr_software_version,
            "SWCreatedBy": settings.itr_software_id,
            "JSONCreatedBy": settings.itr_software_id,
            "JSONCreationDate": comp.filing_date.isoformat(),
            "IntermediaryCity": draft.verification_place.strip(),
            "Digest": "-",
        },
        f"Form_{key}": {
            "FormName": form,
            "Description": (
                "For Individuals and HUFs not having income from profits and gains of business or profession"
                if form == "ITR-2"
                else "For individuals and HUFs having income from business or profession"
            ),
            "AssessmentYear": rules.schema_assessment_year,
            "SchemaVer": rules.schema_version,
            "FormVer": rules.form_version,
        },
        "PartA_GEN1": {"PersonalInfo": _personal(draft), "FilingStatus": _filing_status(comp, rules, form)},
        "ScheduleOS": _other_sources_schedule(draft, comp, schema_file, form),
        **_cyla_bfla(comp, form, schema_file),
        "ScheduleVIA": _deductions(comp, draft, schema_file),
        "ScheduleSI": _special_income(comp, rules),
        "PartB-TI": _total_income(comp, form, schema_file),
        "PartB_TTI": _tax(draft, comp, schema_file, form),
        **_taxes_paid_schedules(draft),
        "Verification": {
            "Declaration": {"AssesseeVerName": full_name, "FatherName": p.father_name.strip(),
                            "AssesseeVerPAN": p.pan.strip().upper()},
            "Capacity": "S",
            "Place": draft.verification_place.strip(),
            "Date": comp.filing_date.isoformat(),
        },
    }
    salary = _salary_schedule(draft, comp)
    if salary:
        body["ScheduleS"] = salary
    if draft.capital_gains:
        cg = _cg_schedules(draft, comp, schema_file, form)
        body["ScheduleCGFor23"] = cg["ScheduleCGFor23"]
        if cg["Schedule112A"]:
            body["Schedule112A"] = cg["Schedule112A"]
    if form == "ITR-3":
        body.update(_business(draft, comp, schema_file))

    return complete_form(schema_file, {"ITR": {key: body}})


def itr23_schema_errors(itr: dict, form: str) -> list[str]:
    return schema_errors(itr, SCHEMAS[form])
