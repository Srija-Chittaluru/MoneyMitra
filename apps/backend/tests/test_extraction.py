import uuid
from pathlib import Path

import pytest

from app.core.config import get_settings
from app.modules.extraction.parsers import UnreadableDocument, extract

FIXTURES = Path(__file__).parent / "fixtures"
AY = "2026-27"


def _fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


@pytest.fixture(autouse=True)
def _storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "document_storage_dir", str(tmp_path))


def _auth_headers(client) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Extract Test", "email": f"ex-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _upload(client, headers, category: str, name: str, content_type: str = "application/pdf") -> dict:
    response = client.post(
        "/api/v1/documents",
        data={"category": category},
        files={"file": (name, _fixture(name), content_type)},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _filing(client, headers) -> dict:
    return client.get(f"/api/v1/itr/filings/{AY}", headers=headers).json()


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------


def test_form16_parser():
    ex = extract("form16", "application/pdf", _fixture("Form16_AY2026-27_SAMPLE.pdf"), [])
    assert ex.assessment_year == AY
    assert ex.fields["personal.pan"] == "ABCDE1234F"
    assert ex.fields["salary.salary_17_1"] == 1500000
    assert ex.rows["salary.employers"] == [
        {"name": "Acme Technologies Pvt Ltd (SAMPLE)", "tan": "BLRA12345B", "income_chargeable": 1425000, "tds": 100000}
    ]


def test_ais_pdf_and_json_agree():
    pdf = extract("ais", "application/pdf", _fixture("AIS_FY2025-26_SAMPLE.pdf"), [])
    js = extract("ais", "application/json", _fixture("AIS_FY2025-26_SAMPLE.json"), [])
    for ex in (pdf, js):
        assert ex.assessment_year == AY
        assert ex.fields["personal.date_of_birth"] == "1990-05-10"
        assert ex.fields["personal.address.state_code"] == "15"
        assert ex.fields["personal.address.pin_code"] == "560038"
        assert ex.fields["other_income.savings_interest"] == 12000
        assert ex.fields["other_income.deposit_interest"] == 30000
        tds = ex.rows["taxes_paid.tds_other"][0]
        assert (tds["tan"], tds["section"], tds["tds_claimed"]) == ("MUMH12345C", "94A", 3000)
    assert js.rows["taxes_paid.tds_other"][0]["deductor_name"] == "HDFC Bank (SAMPLE)"


def test_march_payslip_gives_annual_salary():
    ex = extract("payslips", "application/pdf", _fixture("Payslip_Mar_2026_SAMPLE.pdf"), [])
    assert ex.fields["salary.salary_17_1"] == 1500000
    assert ex.fields["salary.hra.basic_salary"] == 600000


def test_images_are_read_with_ocr_when_available():
    import shutil

    if shutil.which("tesseract") is None:
        with pytest.raises(UnreadableDocument):
            extract("pan", "image/png", _fixture("PAN_Card_SAMPLE.png"), [])
        return
    ex = extract("pan", "image/png", _fixture("PAN_Card_SAMPLE.png"), [])
    assert ex.facts["ocr"] is True
    assert ex.fields["personal.pan"] == "ABCDE1234F"
    assert ex.fields["personal.father_name"] == "RAVI VERMA"
    # The watermark garbles the date ("40/05/1990"): an invalid date is left empty, never filled wrong.
    assert ex.fields.get("personal.date_of_birth") in (None, "1990-05-10")


# ---------------------------------------------------------------------------
# Upload -> ITR autofill
# ---------------------------------------------------------------------------


def test_upload_fills_itr_draft_and_tags_sources(client):
    headers = _auth_headers(client)
    doc = _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    assert doc["extraction_status"] == "extracted"
    assert doc["extraction_message"].startswith("Filled ")

    filing = _filing(client, headers)
    data = filing["data"]
    assert data["personal"]["pan"] == "ABCDE1234F"
    assert data["salary"]["salary_17_1"] == 1500000
    assert data["salary"]["employers"][0]["tan"] == "BLRA12345B"
    assert filing["field_sources"]["salary.salary_17_1"] == "Form 16"
    assert filing["field_sources"]["salary.employers.0.tds"] == "Form 16"
    # Fields no document provides stay empty.
    assert data["personal"]["father_name"] is None
    assert data["bank_accounts"] == []


def test_typed_values_are_never_overwritten(client):
    headers = _auth_headers(client)
    draft = _filing(client, headers)["data"]
    draft["personal"]["pan"] = "ABCDE1234F"  # typed by the user (same PAN as the Form 16)
    draft["personal"]["father_name"] = "TYPED FATHER"
    draft["salary"]["salary_17_1"] = 999
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)

    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    filing = _filing(client, headers)
    assert filing["data"]["personal"]["father_name"] == "TYPED FATHER"
    assert filing["data"]["salary"]["salary_17_1"] == 999
    assert "salary.salary_17_1" not in filing["field_sources"]
    assert filing["data"]["salary"]["employers"][0]["tan"] == "BLRA12345B"  # empty list was filled


def test_multiple_documents_merge_without_duplicates(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.json", "application/json")

    filing = _filing(client, headers)
    data = filing["data"]
    assert len(data["salary"]["employers"]) == 1  # same TAN in Form 16 and AIS
    assert data["other_income"]["savings_interest"] == 12000
    assert data["taxes_paid"]["tds_other"][0]["tan"] == "MUMH12345C"
    assert data["personal"]["first_name"] == "ASHA"
    assert filing["field_sources"]["salary.salary_17_1"] == "Form 16"  # first document wins
    assert filing["field_sources"]["other_income.savings_interest"] == "AIS"


def test_payslip_without_tan_merges_into_form16_employer(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    _upload(client, headers, "payslips", "Payslip_Mar_2026_SAMPLE.pdf")
    employers = _filing(client, headers)["data"]["salary"]["employers"]
    assert len(employers) == 1
    assert employers[0]["tan"] == "BLRA12345B"


def test_documents_uploaded_before_draft_are_applied_on_creation(client):
    headers = _auth_headers(client)
    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.pdf")
    # The upload itself creates the draft; opening ITR Filing shows the values.
    assert _filing(client, headers)["data"]["other_income"]["deposit_interest"] == 30000


def test_editing_an_autofilled_value_drops_its_tag(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    draft = _filing(client, headers)["data"]
    draft["salary"]["salary_17_1"] = 1600000
    saved = client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers).json()
    assert "salary.salary_17_1" not in saved["field_sources"]
    assert saved["field_sources"]["personal.pan"] == "Form 16"


def test_image_upload_is_read_or_reported(client):
    import shutil

    headers = _auth_headers(client)
    doc = _upload(client, headers, "pan", "PAN_Card_SPECIMEN.png", "image/png")
    if shutil.which("tesseract") is None:
        assert doc["extraction_status"] == "unsupported"
    else:
        assert doc["extraction_status"] == "extracted"
        assert "OCR" in doc["extraction_message"]


def test_tax_documents_cannot_be_filed_as_bills(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/documents", data={"category": "bills"},
        files={"file": ("f16.pdf", _fixture("Form16_AY2026-27_SAMPLE.pdf"), "application/pdf")}, headers=headers,
    )
    assert response.status_code == 422
    assert _filing(client, headers)["data"]["salary"]["salary_17_1"] == 0


# ---------------------------------------------------------------------------
# TRACES-style specimens (Form 16 Part A/B + annexure, AIS with TIS, YTD payslip)
# ---------------------------------------------------------------------------


def test_traces_form16_reads_employee_not_employer_pan():
    ex = extract("form16", "application/pdf", _fixture("Form16_TRACES_SPECIMEN.pdf"), [])
    assert ex.assessment_year == AY
    assert ex.fields["personal.pan"] == "BXKPM4821Q"  # not the deductor's AAHCN5732L
    assert ex.fields["salary.salary_17_1"] == 2501400
    assert "salary.perquisites_17_2" not in ex.fields  # "Form No. 12BA" is not an amount
    assert ex.fields["salary.lta_exemption"] == 45000
    assert ex.fields["salary.hra.hra_received"] == 510000
    assert ex.fields["salary.hra.rent_paid"] == 420000
    assert ex.fields["salary.hra.basic_salary"] == 1020000
    assert ex.rows["salary.employers"] == [
        {"name": "NOVASPIRE TECHNOLOGIES PRIVATE LIMITED", "tan": "PNEN12345B",
         "income_chargeable": 2085900, "tds": 376400,
         "address": "LEVEL 6, PANCHSHIL BUSINESS PARK, VIMAN NAGAR", "city": "PUNE", "state_code": "19",
         "pin_code": "411014"}
    ]
    assert sum(r["amount"] for r in ex.rows["deductions.section_80c"]) == 170400
    assert ex.rows["deductions.health_parents.policies"][0]["premium"] == 32000


def test_ais_with_tis_reads_derived_values_and_real_tds_only():
    ex = extract("ais", "application/pdf", _fixture("AIS_TIS_SPECIMEN.pdf"), [])
    assert ex.fields["other_income.savings_interest"] == 22855  # two banks, from the TIS
    assert ex.fields["other_income.deposit_interest"] == 62400
    assert ex.fields["other_income.refund_interest"] == 1240
    dividends = {k: v for k, v in ex.fields.items() if k.startswith("other_income.dividends.")}
    assert sum(dividends.values()) == 35460
    assert ex.fields["eligibility.has_capital_gains"] is True
    tds = {(r["tan"], r["section"], r["tds_claimed"]) for r in ex.rows["taxes_paid.tds_other"]}
    assert tds == {("PNES03311F", "94A", 6240), ("CALI00412C", "194", 2166)}
    assert ex.rows["salary.employers"][0]["tds"] == 376400


def test_march_payslip_ytd_columns():
    ex = extract("payslips", "application/pdf", _fixture("Payslip_YTD_SPECIMEN.pdf"), [])
    assert ex.fields["personal.pan"] == "BXKPM4821Q"  # not the letterhead PAN
    assert ex.fields["salary.salary_17_1"] == 2501400
    assert ex.fields["salary.professional_tax"] == 2500
    assert ex.rows["salary.employers"][0]["tds"] == 376400


def test_ais_with_intraday_trades_needs_itr3(client):
    headers = _auth_headers(client)
    _upload(client, headers, "ais", "AIS_TIS_SPECIMEN.pdf")
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    form = summary["recommended_form"]
    assert form["form"] == "ITR-3"
    assert form["supported"] is True
    assert any("Intraday" in r["reason"] for r in form["reasons"])
    assert {r["form"] for r in form["other_reasons"]} == {"ITR-2"}
    checklist = {c["category"]: c for c in form["checklist"]}
    assert checklist["ais"]["uploaded"] is True
    assert checklist["capital_gains"]["required"] and not checklist["capital_gains"]["uploaded"]
    # The sales and intraday trades from the AIS are filled into the return.
    data = _filing(client, headers)["data"]
    assert len(data["capital_gains"]) == 9
    assert data["trading"]["speculative_profit"] == 50


def test_ais_capital_gains_breakdown():
    ex = extract("ais", "application/pdf", _fixture("AIS_TIS_SPECIMEN.pdf"), [])
    cg = ex.facts["capital_gains"]
    assert (cg["ltcg_112a"], cg["stcg_111a"], cg["debt_stcg"], cg["speculative"]) == (30700, 1950, 4600, 50)
    assert ex.facts["intraday"] is True


def test_form26as_parser():
    ex = extract("form26as", "application/pdf", _fixture("Form26AS_SPECIMEN.pdf"), [])
    assert ex.assessment_year == AY
    assert ex.fields["personal.pan"] == "BXKPM4821Q"
    assert [(e["tan"], e["section"], e["tds"]) for e in ex.facts["tds_26as"]] == [
        ("PNEN12345B", "192", 376400), ("PNES03311F", "194A", 6240), ("CALI00412C", "194", 2166),
    ]
    assert sum(e["tds"] for e in ex.facts["tds_26as"]) == 384806


def test_tds_cross_check_against_26as(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form26as", "Form26AS_SPECIMEN.pdf")
    draft = _filing(client, headers)["data"]
    # A claim that isn't in 26AS, and remove the bank's genuine entry.
    draft["taxes_paid"]["tds_other"] = [
        t for t in draft["taxes_paid"]["tds_other"] if t["tan"] != "PNES03311F"
    ] + [{"deductor_name": "Ram", "tan": "CALI00412K", "section": "94A", "amount_paid": 1, "tds_deducted": 500,
          "tds_claimed": 500, "deducted_year": "2025"}]
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)
    warnings = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()["warnings"]
    assert any("CALI00412K" in w and "not in your Form 26AS" in w for w in warnings)
    assert any("PNES03311F" in w and "isn't claimed" in w for w in warnings)


def test_salary_only_documents_recommend_itr1(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    form = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()["recommended_form"]
    assert form["form"] == "ITR-1" and form["supported"] is True
    assert "capital_gains" not in {c["category"] for c in form["checklist"]}


def test_reread_replaces_autofilled_values_but_keeps_user_edits(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_TRACES_SPECIMEN.pdf")
    draft = _filing(client, headers)["data"]
    # Simulate a bad earlier extraction on one field and a user edit on another.
    filing_sources = _filing(client, headers)["field_sources"]
    assert "salary.lta_exemption" in filing_sources
    draft["personal"]["father_name"] = "VIKRAM MEHTA"
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)

    reread = client.post(f"/api/v1/itr/filings/{AY}/reread-documents", headers=headers)
    assert reread.status_code == 200, reread.text
    body = reread.json()
    assert body["data"]["personal"]["father_name"] == "VIKRAM MEHTA"
    assert body["data"]["salary"]["salary_17_1"] == 2501400
    assert len(body["data"]["salary"]["employers"]) == 1
    assert body["field_sources"]["salary.salary_17_1"] == "Form 16"


def _complete_itr23_draft(client, headers) -> dict:
    """Fields no document contains, as the user would type them."""
    draft = _filing(client, headers)["data"]
    draft["personal"].update(father_name="VIKRAM SURESH MEHTA", mobile="9876543210", employer_category="OTH")
    draft["eligibility"]["is_resident"] = True
    draft["bank_accounts"] = [{"ifsc": "HDFC0001234", "bank_name": "HDFC Bank", "account_no": "50100012344417",
                               "use_for_refund": True}]
    draft["verification_place"] = "Pune"
    return draft


def test_documents_decide_and_fill_itr3(client):
    from app.api.v1.itr import filing_date
    from app.main import app
    from app.modules.itr.export_itr23 import itr23_schema_errors
    from datetime import date

    app.dependency_overrides[filing_date] = lambda: date(2026, 10, 7)
    try:
        headers = _auth_headers(client)
        for category, name in [("form16", "Form16_TRACES_SPECIMEN.pdf"), ("ais", "AIS_TIS_SPECIMEN.pdf"),
                               ("form26as", "Form26AS_SPECIMEN.pdf")]:
            _upload(client, headers, category, name)
        client.put(f"/api/v1/itr/filings/{AY}", json=_complete_itr23_draft(client, headers), headers=headers)

        summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
        assert summary["recommended_form"]["form"] == "ITR-3"
        assert summary["can_export"] is True, summary["missing_fields"] + summary["eligibility_issues"]
        s = summary["selected"]
        assert (s["stcg_111a"], s["stcg_slab"], s["ltcg_112a"], s["speculative_income"]) == (1950, 4600, 30700, 50)
        assert s["total_income"] == 2585660
        assert s["tax_at_special_rates"] == 390  # 20% of 1,950; LTCG under the Rs 1.25 lakh exemption
        assert s["refund_due"] == 19661
        assert summary["filing_section"] == "139(4)"  # ITR-3 due 31 Aug 2026

        exported = client.post(f"/api/v1/itr/filings/{AY}/export", headers=headers)
        assert exported.status_code == 200, exported.text
        body = exported.json()
        assert body["form"] == "ITR-3"
        assert body["file_name"] == "ITR3_AY2026-27_BXKPM4821Q.json"
        assert itr23_schema_errors(body["itr"], "ITR-3") == []
        itr3 = body["itr"]["ITR"]["ITR3"]
        assert itr3["PartB_TTI"]["Refund"]["RefundDue"] == 19661
        assert itr3["PARTA_PL"]["NetIncomeFrmSpecActivity"] == 50
        assert [b["Code"] for b in itr3["PartA_GEN2"]["NatOfBus"]["NatureOfBusiness"]] == ["21009"]
        assert len(itr3["Schedule112A"]["Schedule112ADtls"]) == 3

        pdf = client.get(f"/api/v1/itr/filings/{AY}/export/pdf", headers=headers)
        assert "ITR3_AY2026-27_BXKPM4821Q.pdf" in pdf.headers["content-disposition"]
    finally:
        app.dependency_overrides.pop(filing_date, None)


def test_capital_gains_without_trading_files_itr2(client):
    from app.modules.itr.export_itr23 import itr23_schema_errors

    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_TRACES_SPECIMEN.pdf")
    draft = _complete_itr23_draft(client, headers)
    # Form 16 alone has no name, date of birth or home address — the user types them.
    draft["personal"].update(first_name="ROHAN", last_name="MEHTA", date_of_birth="1991-08-14")
    draft["personal"]["address"].update(flat_no="FLAT 1204", locality="KHARADI", city="PUNE",
                                        state_code="19", pin_code="411014")
    draft["capital_gains"] = [
        {"asset_type": "equity_share", "term": "short", "name": "TATA MOTORS", "isin": "INE155A01022",
         "quantity": 10, "sale_date": "2025-07-21", "sale_value": 50000, "cost": 40000},
        {"asset_type": "equity_mf", "term": "long", "name": "INDEX FUND", "isin": "INF879O01027",
         "quantity": 100, "sale_date": "2025-11-10", "sale_value": 300000, "cost": 100000},
    ]
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    assert summary["recommended_form"]["form"] == "ITR-2"
    s = summary["selected"]
    # 20% of 10,000 + 12.5% of (2,00,000 - 1,25,000)
    assert s["tax_at_special_rates"] == 2000 + 9375
    response = client.post(f"/api/v1/itr/filings/{AY}/export", headers=headers)
    assert response.status_code == 200, response.text
    exported = response.json()
    assert exported["form"] == "ITR-2"
    assert itr23_schema_errors(exported["itr"], "ITR-2") == []


# ---------------------------------------------------------------------------
# Broker tax P&L and the review of the ITR-3 for the specimen taxpayer
# ---------------------------------------------------------------------------


def test_broker_statement_parser():
    ex = extract("capital_gains", "application/pdf", _fixture("Broker_TaxPnL_SPECIMEN.pdf"), [])
    assert ex.fields["trading.speculative_profit"] == -165  # 50 gross - 215.13 charges
    assert ex.fields["trading.fno_profit"] == 6023  # 6,022.50 rounded half-up
    assert ex.fields["trading.fno_expenses"] == 632
    assert ex.fields["trading.fno_turnover"] == 45874
    rows = ex.rows["capital_gains"]
    assert len(rows) == 9
    infosys = next(r for r in rows if r["isin"] == "INE009A01021")
    assert (infosys["purchase_date"], infosys["term"], infosys["cost"]) == ("2023-01-15", "long", 61000)
    debt = next(r for r in rows if r["isin"] == "INF179KB1HP9")
    assert debt["asset_type"] == "debt_mf"
    assert ex.facts["identity"]["bank_accounts"] == ["4417"]


def test_broker_statement_replaces_ais_trading_figures_but_not_user_edits(client):
    headers = _auth_headers(client)
    _upload(client, headers, "ais", "AIS_TIS_SPECIMEN.pdf")
    assert _filing(client, headers)["data"]["trading"]["speculative_profit"] == 50  # gross, from AIS
    _upload(client, headers, "capital_gains", "Broker_TaxPnL_SPECIMEN.pdf")
    filing = _filing(client, headers)
    trading = filing["data"]["trading"]
    assert trading["speculative_profit"] == -165  # net of charges, from the broker statement
    assert trading["fno_profit"] - trading["fno_expenses"] == 5391
    assert filing["field_sources"]["trading.speculative_profit"] == "broker statement"
    assert len(filing["data"]["capital_gains"]) == 9  # matched to the AIS rows, not duplicated
    assert filing["data"]["capital_gains"][0]["purchase_date"] is not None

    # A value the user typed is never replaced.
    headers2 = _auth_headers(client)
    _upload(client, headers2, "ais", "AIS_TIS_SPECIMEN.pdf")
    draft = _filing(client, headers2)["data"]
    draft["trading"]["speculative_profit"] = 10
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers2)
    _upload(client, headers2, "capital_gains", "Broker_TaxPnL_SPECIMEN.pdf")
    assert _filing(client, headers2)["data"]["trading"]["speculative_profit"] == 10


def test_reviewed_itr3_numbers_and_checks(client):
    from datetime import date

    from app.api.v1.itr import filing_date
    from app.main import app
    from app.modules.itr.export_itr23 import itr23_schema_errors

    app.dependency_overrides[filing_date] = lambda: date(2026, 10, 7)
    try:
        headers = _auth_headers(client)
        for category, name in [("form16", "Form16_TRACES_SPECIMEN.pdf"), ("ais", "AIS_TIS_SPECIMEN.pdf"),
                               ("payslips", "Payslip_YTD_SPECIMEN.pdf"), ("form26as", "Form26AS_SPECIMEN.pdf"),
                               ("capital_gains", "Broker_TaxPnL_SPECIMEN.pdf")]:
            _upload(client, headers, category, name)
        draft = _complete_itr23_draft(client, headers)
        # Test data like the reviewed return: none of it matches the documents.
        draft["personal"].update(father_name="dfghj", mobile="9181166543", aadhaar="123456786789",
                                 email="someone.else@gmail.com")
        draft["bank_accounts"] = [{"ifsc": "TEST0001234", "bank_name": "Test Bank of India",
                                   "account_no": "123456789012", "use_for_refund": True}]
        client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)
        summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
        s = summary["selected"]
        assert (s["business_income"], s["speculative_income"]) == (5391, 0)
        assert s["losses_carried_forward"] == {}  # belated: the speculative loss lapses (section 80)
        assert s["total_income"] == 2591000
        assert s["refund_due"] == 17995
        warnings = " ".join(summary["warnings"])
        for expected in ("doesn't look like a real name", "AIS shows one ending 6624", "98XXXXXX37",
                         "rohan.mehta91@examplemail.in", "looks like test data", "ending 4417",
                         "can't be carried forward"):
            assert expected in warnings, expected

        exported = client.post(f"/api/v1/itr/filings/{AY}/export", headers=headers).json()
        assert itr23_schema_errors(exported["itr"], "ITR-3") == []
        itr3 = exported["itr"]["ITR"]["ITR3"]
        assert [b["Code"] for b in itr3["PartA_GEN2"]["NatOfBus"]["NatureOfBusiness"]] == ["21009", "21010"]
        assert itr3["PARTA_PL"]["NoBooksOfAccPL"]["NetProfit"] == 5391
    finally:
        app.dependency_overrides.pop(filing_date, None)
