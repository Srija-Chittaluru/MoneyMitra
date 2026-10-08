import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.api.v1.itr import filing_date
from app.main import app
from app.modules.itr import interest
from app.modules.itr.computation import compute
from app.modules.itr.export import build_itr_json, schema_errors
from app.modules.itr.rules import AY_2026_27
from app.modules.itr.schemas import ItrDraftData

D = Decimal
AY = "2026-27"
BELATED = date(2026, 10, 1)
ON_TIME = date(2026, 7, 15)


def _auth_headers(client) -> dict:
    email = f"itr-test-{uuid.uuid4()}@example.com"
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Itr Test", "email": email, "password": "correct-horse-battery", "date_of_birth": "1990-05-10"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _complete_draft(**overrides) -> dict:
    draft = {
        "regime": "new",
        "personal": {
            "first_name": "Asha",
            "last_name": "Verma",
            "father_name": "Ravi Verma",
            "pan": "ABCDE1234F",
            "aadhaar": "123412341234",
            "date_of_birth": "1990-05-10",
            "mobile": "9876543210",
            "email": "asha@example.com",
            "employer_category": "OTH",
            "address": {
                "flat_no": "12B",
                "locality": "Indiranagar",
                "city": "Bengaluru",
                "state_code": "15",
                "pin_code": "560038",
            },
        },
        "eligibility": {"is_resident": True},
        "salary": {
            "salary_17_1": 1500000,
            "employers": [{"name": "Acme Pvt Ltd", "tan": "BLRA12345B", "income_chargeable": 1425000, "tds": 100000}],
        },
        "other_income": {"savings_interest": 12000, "deposit_interest": 30000},
        "bank_accounts": [
            {"ifsc": "HDFC0001234", "bank_name": "HDFC Bank", "account_no": "50100012345678", "use_for_refund": True}
        ],
        "verification_place": "Bengaluru",
    }
    draft.update(overrides)
    return draft


def _old_regime_draft() -> dict:
    draft = _complete_draft(regime="old")
    draft["salary"] |= {
        "hra": {"basic_salary": 600000, "hra_received": 240000, "rent_paid": 300000, "is_metro": True},
        "professional_tax": 2500,
    }
    draft["deductions"] = {
        "section_80c": [{"description": "PPF", "identification_no": "PPF001", "amount": 150000}],
        "health_self": {
            "claiming": True,
            "policies": [{"insurer": "Star Health", "policy_no": "P-1", "premium": 20000}],
        },
    }
    return draft


# ---------------------------------------------------------------------------
# Interest helpers
# ---------------------------------------------------------------------------


def test_months_or_part_counts_part_months():
    assert interest.months_or_part(date(2026, 8, 1), date(2026, 10, 1)) == 3
    assert interest.months_or_part(date(2026, 4, 1), date(2026, 4, 30)) == 1
    assert interest.months_or_part(date(2026, 8, 1), date(2026, 7, 31)) == 0


def test_234a_reduces_after_self_assessment_payment():
    payments = [interest.Payment(date(2026, 8, 20), D("3000"))]
    # Aug on 5000, then Sep–Oct on 2000.
    assert interest.interest_234a(D("5000"), payments, BELATED, AY_2026_27) == D("50") + D("40")


def test_234b_not_charged_below_threshold():
    assert interest.interest_234b(D("9999"), D("0"), [], BELATED, AY_2026_27) == 0


def test_234c_safe_harbour_on_first_installment():
    paid = [interest.Payment(date(2025, 6, 10), D("1200"))]  # 12% of 10000 by 15 Jun
    result = interest.interest_234c(D("10000"), paid, AY_2026_27)
    # Jun skipped; Sep 4500-1200=3300 x3%; Dec 7500-1200=6300 x3%; Mar 10000-1200=8800 x1%
    assert result == D("99") + D("189") + D("88")


def test_234f_fee():
    assert interest.fee_234f(D("400000"), D("400000"), BELATED, AY_2026_27) == 0
    assert interest.fee_234f(D("450000"), D("400000"), BELATED, AY_2026_27) == 1000
    assert interest.fee_234f(D("600000"), D("400000"), BELATED, AY_2026_27) == 5000
    assert interest.fee_234f(D("600000"), D("400000"), ON_TIME, AY_2026_27) == 0


# ---------------------------------------------------------------------------
# Computation
# ---------------------------------------------------------------------------


def test_new_regime_belated_computation():
    s = compute(ItrDraftData.model_validate(_complete_draft()), "new", AY_2026_27, BELATED).summary
    assert s.income_from_salary == 1425000
    assert s.gross_total_income == 1467000
    assert s.total_income == 1467000
    assert s.tax_on_total_income == 100050
    assert s.cess == 4002
    assert s.gross_tax_liability == 104052
    assert s.interest_234a == 120  # 4000 x 1% x 3 months (Aug–Oct)
    assert s.interest_234b == 0
    assert s.fee_234f == 5000
    assert s.total_tax_and_interest == 109172
    assert s.balance_payable == 9172
    assert s.refund_due == 0


def test_old_regime_on_time_computation():
    comp = compute(ItrDraftData.model_validate(_old_regime_draft()), "old", AY_2026_27, ON_TIME)
    s = comp.summary
    assert comp.hra.exemption == 240000
    assert s.net_salary == 1260000
    assert s.income_from_salary == 1207500
    assert s.deduction_breakup == {"80C": 150000, "80D": 20000, "80TTA": 10000}
    assert s.total_income == 1069500
    assert s.gross_tax_liability == 138684
    assert s.interest_234b == 1544  # 38600 x 1% x 4 months (Apr–Jul)
    assert s.interest_234c == 174 + 522 + 870 + 386
    assert s.interest_234a == 0
    assert s.fee_234f == 0
    assert s.balance_payable == 142180 - 100000


def test_new_regime_rebate_and_refund():
    draft = _complete_draft()
    draft["salary"] = {
        "salary_17_1": 1000000,
        "employers": [{"name": "Acme Pvt Ltd", "tan": "BLRA12345B", "income_chargeable": 925000, "tds": 20000}],
    }
    draft["other_income"] = {}
    s = compute(ItrDraftData.model_validate(draft), "new", AY_2026_27, BELATED).summary
    assert s.total_income == 925000
    assert s.rebate_87a == s.tax_on_total_income
    assert s.gross_tax_liability == 0
    assert s.fee_234f == 5000  # rebate does not waive the late fee
    assert s.refund_due == 15000


def test_self_occupied_interest_only_in_old_regime():
    draft = _old_regime_draft()
    draft["house_properties"] = [{"property_type": "self_occupied", "interest_on_loan": 250000}]
    parsed = ItrDraftData.model_validate(draft)
    assert compute(parsed, "old", AY_2026_27, ON_TIME).summary.income_from_house_property == -200000
    assert compute(parsed, "new", AY_2026_27, ON_TIME).summary.income_from_house_property == 0


def test_let_out_property_standard_deduction():
    draft = _complete_draft()
    draft["house_properties"] = [
        {"property_type": "let_out", "gross_rent": 300000, "municipal_tax_paid": 10000, "interest_on_loan": 50000}
    ]
    comp = compute(ItrDraftData.model_validate(draft), "new", AY_2026_27, BELATED)
    p = comp.properties[0]
    assert (p.balance, p.standard_deduction, p.income) == (290000, 87000, 153000)


# ---------------------------------------------------------------------------
# Export matches the official schema
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "draft_factory, regime, as_of",
    [(_complete_draft, "new", BELATED), (_old_regime_draft, "old", ON_TIME)],
)
def test_export_validates_against_official_schema(draft_factory, regime, as_of):
    raw = draft_factory()
    raw["house_properties"] = [
        {
            "property_type": "let_out",
            "address": "45 MG Road",
            "city": "Bengaluru",
            "state_code": "15",
            "pin_code": "560001",
            "gross_rent": 240000,
            "interest_on_loan": 40000,
            "tenant_name": "R Kumar",
            "loan": {
                "lender_name": "SBI",
                "account_no": "LN12345",
                "sanction_date": "2020-01-15",
                "total_amount": 2000000,
                "outstanding_amount": 1200000,
            },
        }
    ]
    raw["other_income"]["dividends"] = {"sep_16_to_dec_15": 5000}
    raw["taxes_paid"] = {
        "tds_other": [
            {"deductor_name": "HDFC Bank", "tan": "MUMH12345C", "amount_paid": 30000, "tds_deducted": 3000,
             "tds_claimed": 3000}
        ],
        "challans": [{"bsr_code": "0510002", "date_of_deposit": "2026-06-10", "challan_serial_no": "12345",
                      "amount": 5000}],
    }
    draft = ItrDraftData.model_validate(raw)
    comp = compute(draft, regime, AY_2026_27, as_of)
    itr = build_itr_json(draft, comp, AY_2026_27)
    assert schema_errors(itr, AY_2026_27) == []

    itr1 = itr["ITR"]["ITR1"]
    assert itr1["FilingStatus"]["ReturnFileSec"] == (12 if as_of > AY_2026_27.due_date else 11)
    assert itr1["FilingStatus"]["OptOutNewTaxRegime"] == ("Y" if regime == "old" else "N")
    taxes = itr1["TaxPaid"]["TaxesPaid"]
    assert taxes["TotalTaxesPaid"] == taxes["TDS"] + taxes["TCS"] + taxes["AdvanceTax"] + taxes["SelfAssessmentTax"]
    tax = itr1["ITR1_TaxComputation"]
    assert tax["TotTaxPlusIntrstPay"] == tax["NetTaxLiability"] + tax["TotalIntrstPay"]
    if regime == "old":
        assert "Schedule80C" in itr1 and "Schedule80D" in itr1 and "ScheduleEA10_13A" in itr1


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------


@pytest.fixture
def as_of_belated():
    app.dependency_overrides[filing_date] = lambda: BELATED
    yield
    app.dependency_overrides.pop(filing_date, None)


@pytest.fixture
def as_of_on_time():
    app.dependency_overrides[filing_date] = lambda: ON_TIME
    yield
    app.dependency_overrides.pop(filing_date, None)


def test_itr_endpoints_require_auth(client):
    assert client.get(f"/api/v1/itr/filings/{AY}").status_code == 401
    assert client.get("/api/v1/itr/assessment-years").status_code == 401


def test_unknown_assessment_year(client):
    response = client.get("/api/v1/itr/filings/1999-00", headers=_auth_headers(client))
    assert response.status_code == 404


def test_new_draft_is_prefilled_from_account(client):
    headers = _auth_headers(client)
    body = client.get(f"/api/v1/itr/filings/{AY}", headers=headers).json()
    assert body["status"] == "draft"
    assert body["data"]["personal"]["date_of_birth"] == "1990-05-10"
    assert body["data"]["personal"]["email"].startswith("itr-test-")


def test_save_summary_and_export_flow(client, as_of_belated):
    headers = _auth_headers(client)
    saved = client.put(f"/api/v1/itr/filings/{AY}", json=_complete_draft(), headers=headers)
    assert saved.status_code == 200, saved.text

    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    assert summary["filing_section"] == "139(4)"
    assert summary["old_regime_allowed"] is False
    assert summary["alternative"] is None
    assert summary["missing_fields"] == []
    assert summary["can_export"] is True
    assert summary["selected"]["balance_payable"] == 9172

    exported = client.post(f"/api/v1/itr/filings/{AY}/export", headers=headers)
    assert exported.status_code == 200, exported.text
    assert exported.json()["file_name"] == "ITR1_AY2026-27_ABCDE1234F.json"
    assert client.get(f"/api/v1/itr/filings/{AY}", headers=headers).json()["status"] == "exported"


def test_old_regime_rejected_after_due_date(client, as_of_belated):
    headers = _auth_headers(client)
    client.put(f"/api/v1/itr/filings/{AY}", json=_old_regime_draft(), headers=headers)
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    assert summary["selected"]["regime"] == "new"
    assert any(i["field"] == "regime" for i in summary["eligibility_issues"])
    assert summary["can_export"] is False
    assert client.post(f"/api/v1/itr/filings/{AY}/export", headers=headers).status_code == 422


def test_old_regime_allowed_before_due_date(client, as_of_on_time):
    headers = _auth_headers(client)
    client.put(f"/api/v1/itr/filings/{AY}", json=_old_regime_draft(), headers=headers)
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    assert summary["filing_section"] == "139(1)"
    assert summary["selected"]["regime"] == "old"
    assert summary["alternative"]["regime"] == "new"
    assert summary["can_export"] is True
    assert client.post(f"/api/v1/itr/filings/{AY}/export", headers=headers).status_code == 200


def test_incomplete_draft_lists_missing_fields(client, as_of_belated):
    headers = _auth_headers(client)
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    fields = {i["field"] for i in summary["missing_fields"]}
    assert {"personal.pan", "personal.last_name", "bank_accounts", "verification_place"} <= fields
    assert summary["can_export"] is False


def test_invalid_formats_are_reported(client, as_of_belated):
    headers = _auth_headers(client)
    draft = _complete_draft()
    draft["personal"]["pan"] = "ABC123"
    draft["bank_accounts"][0]["ifsc"] = "HDFC1234"
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    fields = {i["field"] for i in summary["missing_fields"]}
    assert {"personal.pan", "bank_accounts.0.ifsc"} <= fields


def test_ineligible_answers_block_export(client, as_of_belated):
    headers = _auth_headers(client)
    draft = _complete_draft(eligibility={"is_resident": True, "has_capital_gains": True})
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    assert summary["recommended_form"]["form"] == "ITR-2"
    # The form is decided, but the sales themselves still have to be entered.
    assert summary["missing_fields"][0]["field"] == "capital_gains"
    assert summary["can_export"] is False


def test_negative_amount_rejected_on_save(client):
    headers = _auth_headers(client)
    draft = _complete_draft()
    draft["salary"]["salary_17_1"] = -1
    assert client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers).status_code == 422


def test_pdf_summary_download(client, as_of_belated):
    headers = _auth_headers(client)
    client.put(f"/api/v1/itr/filings/{AY}", json=_complete_draft(), headers=headers)
    response = client.get(f"/api/v1/itr/filings/{AY}/export/pdf", headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
    assert "ITR1_AY2026-27_ABCDE1234F.pdf" in response.headers["content-disposition"]


def test_pdf_available_for_incomplete_draft(client, as_of_belated):
    headers = _auth_headers(client)
    response = client.get(f"/api/v1/itr/filings/{AY}/export/pdf", headers=headers)
    assert response.status_code == 200
    assert "ITR1_AY2026-27_DRAFT.pdf" in response.headers["content-disposition"]


def test_smart_checks(client, as_of_belated):
    headers = _auth_headers(client)
    draft = _complete_draft()
    draft["personal"]["last_name"] = "Sharma"  # PAN ABCDE1234F has 'E' as its 5th character
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)
    warnings = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()["warnings"]
    assert any("doesn't match your PAN" in w for w in warnings)

    empty = _complete_draft()
    empty["salary"] = {"employers": []}
    empty["other_income"] = {}
    client.put(f"/api/v1/itr/filings/{AY}", json=empty, headers=headers)
    warnings = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()["warnings"]
    assert any("total income in this return is zero" in w for w in warnings)


# ---------------------------------------------------------------------------
# Capital gains tax rules
# ---------------------------------------------------------------------------


def _cg_draft(txns, salary=0):
    raw = _complete_draft()
    raw["salary"] = {"salary_17_1": salary, "employers": []}
    raw["other_income"] = {}
    raw["capital_gains"] = txns
    return ItrDraftData.model_validate(raw)


def test_short_term_loss_sets_off_long_term_gain_but_not_reverse():
    from app.modules.itr.computation import capital_gains

    cg = capital_gains(_cg_draft([
        {"asset_type": "equity_share", "term": "short", "sale_value": 10000, "cost": 30000},
        {"asset_type": "equity_share", "term": "long", "sale_value": 100000, "cost": 50000},
    ]))
    assert (cg.stcg_111a, cg.ltcg_112a, cg.stcl_carried_forward) == (0, 30000, 0)

    cg = capital_gains(_cg_draft([
        {"asset_type": "equity_share", "term": "short", "sale_value": 30000, "cost": 10000},
        {"asset_type": "equity_share", "term": "long", "sale_value": 50000, "cost": 100000},
    ]))
    assert (cg.stcg_111a, cg.ltcg_112a, cg.ltcl_carried_forward) == (20000, 0, 50000)


def test_unused_basic_exemption_absorbs_special_rate_gains():
    # No other income: 3 lakh of 111A gains fall within the Rs 4 lakh new-regime exemption.
    comp = compute(_cg_draft([
        {"asset_type": "equity_share", "term": "short", "sale_value": 400000, "cost": 100000},
    ]), "new", AY_2026_27, ON_TIME)
    assert comp.summary.stcg_111a == 300000
    assert comp.summary.tax_at_special_rates == 0


def test_new_regime_rebate_not_available_on_special_rate_tax():
    # Salary keeps normal income under Rs 12 lakh (slab tax fully rebated), but 111A tax stays.
    comp = compute(_cg_draft([
        {"asset_type": "equity_share", "term": "short", "sale_value": 150000, "cost": 50000},
    ], salary=900000), "new", AY_2026_27, ON_TIME)
    s = comp.summary
    assert s.rebate_87a == s.tax_at_normal_rates
    assert s.tax_at_special_rates == 20000
    assert s.tax_after_rebate == 20000


def test_debt_fund_gains_are_taxed_at_slab_rates():
    comp = compute(_cg_draft([
        {"asset_type": "debt_mf", "term": "long", "sale_value": 200000, "cost": 100000},
    ], salary=1500000), "new", AY_2026_27, ON_TIME)
    assert comp.summary.stcg_slab == 100000
    assert comp.summary.tax_at_special_rates == 0
