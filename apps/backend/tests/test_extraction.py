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


def test_images_are_unsupported():
    with pytest.raises(UnreadableDocument):
        extract("pan", "image/png", _fixture("PAN_Card_SAMPLE.png"), [])


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
    draft["personal"]["pan"] = "ZZZZZ9999Z"
    draft["salary"]["salary_17_1"] = 999
    client.put(f"/api/v1/itr/filings/{AY}", json=draft, headers=headers)

    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    filing = _filing(client, headers)
    assert filing["data"]["personal"]["pan"] == "ZZZZZ9999Z"
    assert filing["data"]["salary"]["salary_17_1"] == 999
    assert "personal.pan" not in filing["field_sources"]
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


def test_image_upload_is_stored_but_not_read(client):
    headers = _auth_headers(client)
    doc = _upload(client, headers, "pan", "PAN_Card_SAMPLE.png", "image/png")
    assert doc["extraction_status"] == "unsupported"
    assert "Images" in doc["extraction_message"]


def test_bills_are_not_extracted(client):
    headers = _auth_headers(client)
    doc = _upload(client, headers, "bills", "Form16_AY2026-27_SAMPLE.pdf")
    assert doc["extraction_status"] == "not_applicable"
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
         "income_chargeable": 2085900, "tds": 376400}
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


def test_capital_gains_in_ais_blocks_itr1(client):
    headers = _auth_headers(client)
    _upload(client, headers, "ais", "AIS_TIS_SPECIMEN.pdf")
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    assert "eligibility.has_capital_gains" in {i["field"] for i in summary["eligibility_issues"]}


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
