"""Level 3: recommendations drawn from uploaded documents."""

import uuid
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core.config import get_settings
from app.modules.recommendations import document_rules
from app.modules.recommendations.context import FinancialContext
from app.modules.recommendations.document_analysis import analyse
from app.modules.recommendations.facts import Facts
from app.modules.recommendations.levels import Level
from app.modules.recommendations.money import format_inr
from app.modules.recommendations.stages import LifeStage

URL = "/api/v1/recommendations"
FIXTURES = Path(__file__).parent / "fixtures"
TODAY = date(2026, 10, 6)
AY = "2026-27"


@pytest.fixture(autouse=True)
def _storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "document_storage_dir", str(tmp_path))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _years_ago(years: int) -> str:
    today = date.today()
    return today.replace(year=today.year - years, day=min(today.day, 28)).isoformat()


def _auth_headers(client, age: int | None = 35) -> dict:
    payload = {"name": "Doc Reco", "email": f"docreco-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"}
    if age is not None:
        payload["date_of_birth"] = _years_ago(age)
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _upload(client, headers, category: str, name: str, content_type: str = "application/pdf") -> dict:
    response = client.post(
        "/api/v1/documents",
        data={"category": category},
        files={"file": (name, (FIXTURES / name).read_bytes(), content_type)},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _get(client, headers) -> dict:
    response = client.get(URL, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _by_id(body) -> dict:
    return {rec["id"]: rec for rec in body["recommendations"]}


def _fake_doc(category="form16", status="extracted", fields=None, rows=None, ay=AY, message=None, name="doc.pdf"):
    extracted = {"assessment_year": ay, "fields": fields or {}, "rows": rows or {}, "notes": []}
    return SimpleNamespace(
        category=category, file_name=name, extraction_status=status, extraction_message=message, extracted=extracted
    )


FORM16_FIELDS = {"salary.salary_17_1": 1_500_000}
FORM16_ROWS = {"salary.employers": [{"name": "Acme", "tan": "BLRA12345B", "tds": 100_000}]}


def _facts(analysis, declared=None) -> Facts:
    return Facts(
        level=Level.DOCUMENTS, today=TODAY, tax_year="2025-26", date_of_birth=date(1990, 1, 1), age=36,
        stage=LifeStage.MID_CAREER, employee_category=None, expected_income=None, declared=declared,
        documents=analysis,
    )


def _declared(**overrides) -> FinancialContext:
    values = dict(
        source="itr_filing", annual_income=1_500_000, section_80c_total=0, section_80ccd_1b=0,
        claims_health_self=False, claims_health_parents=False, other_income_total=0,
    )
    return FinancialContext(**{**values, **overrides})


# ---------------------------------------------------------------------------
# Document analysis: which documents are used, and why others aren't
# ---------------------------------------------------------------------------


def test_usable_documents_are_analysed():
    result = analyse([_fake_doc(fields=FORM16_FIELDS, rows=FORM16_ROWS)], date(1990, 1, 1), TODAY)
    assert result.usable
    assert [d.label for d in result.analysed] == ["Form 16"]
    assert result.skipped == []
    assert result.summary is not None and result.draft.salary.salary_17_1 == 1_500_000


@pytest.mark.parametrize(
    ("doc", "reason"),
    [
        (_fake_doc(category="pan", fields={"personal.pan": "ABCDE1234F"}), "identity"),
        (_fake_doc(category="bills"), "isn't analysed yet"),
        (_fake_doc(category="tax_proofs"), "isn't analysed yet"),
        (_fake_doc(status="unsupported", message="Images can't be read automatically yet."), "Images can't be read"),
        (_fake_doc(status="unsupported"), "couldn't be read"),
        (_fake_doc(status="nothing_found"), "No usable figures"),
        (_fake_doc(fields={}, rows={}), "No usable figures"),
        (_fake_doc(fields=FORM16_FIELDS, ay="2030-31"), "assessment year 2030-31"),
    ],
)
def test_skipped_documents_say_why(doc, reason):
    result = analyse([doc], date(1990, 1, 1), TODAY)
    assert not result.usable
    assert result.summary is None and result.draft is None
    assert len(result.skipped) == 1 and reason in result.skipped[0].reason


def test_documents_with_no_year_are_assumed_current():
    assert analyse([_fake_doc(category="payslips", fields=FORM16_FIELDS, ay=None)], None, TODAY).usable


def test_one_bad_document_does_not_block_the_good_ones():
    docs = [_fake_doc(category="bills"), _fake_doc(fields=FORM16_FIELDS, rows=FORM16_ROWS, name="f16.pdf")]
    result = analyse(docs, None, TODAY)
    assert result.usable and [d.file_name for d in result.analysed] == ["f16.pdf"]
    assert len(result.skipped) == 1


def test_source_text_joins_labels():
    docs = [
        _fake_doc(category="form16", fields=FORM16_FIELDS),
        _fake_doc(category="ais", fields=FORM16_FIELDS),
        _fake_doc(category="payslips", fields=FORM16_FIELDS),
    ]
    assert analyse(docs[:2], None, TODAY).source_text == "Form 16 and AIS"
    assert analyse(docs, None, TODAY).source_text == "Form 16, AIS and payslip"
    assert analyse(docs[:1] * 2, None, TODAY).source_text == "Form 16"  # no duplicates


# ---------------------------------------------------------------------------
# Rules, on their own
# ---------------------------------------------------------------------------


def test_tds_vs_tax_refund_balance_and_payslip_only():
    form16 = analyse([_fake_doc(fields=FORM16_FIELDS, rows=FORM16_ROWS)], None, TODAY)
    [rec] = document_rules.tds_vs_tax(_facts(form16))
    assert rec.level == 3 and rec.basis == "From your Form 16" and rec.id == "doc_tds_vs_tax"
    selected = form16.summary.selected
    assert format_inr(selected.total_taxes_paid) in rec.description
    # The sample is filed after the due date, so the estimate includes a late fee; the card must say so.
    assert ("including interest and late fees" in rec.description) == (
        selected.total_tax_and_interest > selected.gross_tax_liability
    )
    if selected.refund_due:
        assert rec.title == "You may get a tax refund" and format_inr(selected.refund_due) in rec.description
    else:
        assert rec.title == "You may owe more tax" and format_inr(selected.balance_payable) in rec.description

    underpaid = analyse(
        [_fake_doc(fields=FORM16_FIELDS, rows={"salary.employers": [{"name": "Acme", "tds": 10_000}]})], None, TODAY
    )
    assert document_rules.tds_vs_tax(_facts(underpaid))[0].title == "You may owe more tax"

    overpaid = analyse(
        [_fake_doc(fields=FORM16_FIELDS, rows={"salary.employers": [{"name": "Acme", "tds": 400_000}]})], None, TODAY
    )
    assert document_rules.tds_vs_tax(_facts(overpaid))[0].title == "You may get a tax refund"

    payslip = analyse([_fake_doc(category="payslips", fields=FORM16_FIELDS, rows=FORM16_ROWS)], None, TODAY)
    assert document_rules.tds_vs_tax(_facts(payslip)) == []  # a payslip covers only part of the year


def test_ais_income_gap_vs_declared():
    ais = analyse([_fake_doc(category="ais", fields={"other_income.savings_interest": 12_000,
                                                      "other_income.deposit_interest": 30_000})], None, TODAY)
    [rec] = document_rules.ais_income_gap(_facts(ais, _declared(other_income_total=12_000)))
    assert "₹42,000" in rec.description and "₹12,000" in rec.description and rec.basis == "From your AIS"

    assert document_rules.ais_income_gap(_facts(ais, _declared(other_income_total=42_000))) == []
    assert document_rules.ais_income_gap(_facts(ais, _declared(other_income_total=41_500))) == []  # under the threshold
    assert "₹42,000" in document_rules.ais_income_gap(_facts(ais, None))[0].description  # nothing declared at all

    [unknown] = document_rules.ais_income_gap(_facts(ais, _declared(source="tax_comparison", other_income_total=None)))
    assert "included in the income you declare" in unknown.description

    no_income = analyse([_fake_doc(category="ais", fields={"salary.salary_17_1": 100_000})], None, TODAY)
    assert document_rules.ais_income_gap(_facts(no_income)) == []
    form16_only = analyse([_fake_doc(fields=FORM16_FIELDS)], None, TODAY)
    assert document_rules.ais_income_gap(_facts(form16_only)) == []


def test_form16_deductions_variants():
    none_on_form = analyse([_fake_doc(fields=FORM16_FIELDS)], None, TODAY)
    [rec] = document_rules.form16_deductions(_facts(none_on_form))
    assert rec.id == "tax_80c" and "no Section 80C deductions" in rec.description

    rows = {"deductions.section_80c": [{"description": "EPF", "amount": 90_000}]}
    with_80c = analyse([_fake_doc(fields=FORM16_FIELDS, rows=rows)], None, TODAY)
    [rec] = document_rules.form16_deductions(_facts(with_80c))
    assert "₹90,000" in rec.description and "₹60,000" in rec.description

    [mismatch] = document_rules.form16_deductions(_facts(with_80c, _declared(section_80c_total=20_000)))
    assert "₹90,000" in mismatch.description and "only ₹20,000" in mismatch.description

    [more_in_draft] = document_rules.form16_deductions(_facts(with_80c, _declared(section_80c_total=150_000)))
    assert "uses your full limit" in more_in_draft.description

    # A tax comparison has no per-item 80C, so it can't be checked against Form 16.
    [from_comparison] = document_rules.form16_deductions(_facts(with_80c, _declared(source="tax_comparison")))
    assert "₹60,000" in from_comparison.description

    ais_only = analyse([_fake_doc(category="ais", fields=FORM16_FIELDS)], None, TODAY)
    assert document_rules.form16_deductions(_facts(ais_only)) == []


def test_hra_claim_variants():
    payslip = analyse([_fake_doc(category="payslips", fields={**FORM16_FIELDS, "salary.hra.hra_received": 240_000})],
                      None, TODAY)
    [rec] = document_rules.hra_claim(_facts(payslip))
    assert "₹2,40,000" in rec.description and rec.action_href == "/itr-filing"

    assert document_rules.hra_claim(_facts(payslip, _declared(rent_paid=300_000))) == []
    with_rent = analyse([_fake_doc(category="payslips", fields={**FORM16_FIELDS, "salary.hra.hra_received": 240_000,
                                                               "salary.hra.rent_paid": 300_000})], None, TODAY)
    assert document_rules.hra_claim(_facts(with_rent)) == []
    no_hra = analyse([_fake_doc(fields=FORM16_FIELDS)], None, TODAY)
    assert document_rules.hra_claim(_facts(no_hra)) == []


# ---------------------------------------------------------------------------
# End to end, with the real sample documents
# ---------------------------------------------------------------------------


def test_no_documents_means_empty_documents_report(client):
    body = _get(client, _auth_headers(client))
    assert body["level"] == 1
    assert body["documents"] == {"analysed": [], "skipped": []}
    assert body["next_step"]["title"] == "Add your income"


def test_uploading_documents_reaches_level_3(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.pdf")
    _upload(client, headers, "payslips", "Payslip_Mar_2026_SAMPLE.pdf")

    body = _get(client, headers)
    assert body["level"] == 3 and body["level_label"] == "Your documents"
    assert body["next_step"] is None
    assert {d["category"] for d in body["documents"]["analysed"]} == {"form16", "ais", "payslips"}
    assert body["documents"]["skipped"] == []

    recs = _by_id(body)
    assert recs["doc_tds_vs_tax"]["level"] == 3
    assert recs["doc_tds_vs_tax"]["basis"].startswith("From your ")
    assert "Form 16" in recs["doc_tds_vs_tax"]["basis"]
    assert recs["tax_80c"]["basis"] == "From your Form 16"  # the lower-level 80C rule deferred to Form 16
    assert "no Section 80C deductions" in recs["tax_80c"]["description"]
    assert "doc_hra_claim" in recs and "₹2,40,000" in recs["doc_hra_claim"]["description"]
    assert len([r for r in body["recommendations"] if r["id"] == "tax_80c"]) == 1  # topic appears once


def test_tds_figures_match_the_itr_summary(client):
    headers = _auth_headers(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.pdf")

    selected = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()["selected"]
    rec = _by_id(_get(client, headers))["doc_tds_vs_tax"]
    assert format_inr(selected["total_taxes_paid"]) in rec["description"]
    expected = format_inr(selected["refund_due"] or selected["balance_payable"])
    assert expected in rec["description"]


def test_ais_income_gap_appears_when_draft_misses_it(client):
    headers = _auth_headers(client)
    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.pdf")
    assert "doc_ais_income" not in _by_id(_get(client, headers))  # autofill put it in the draft

    draft = client.get(f"/api/v1/itr/filings/{AY}", headers=headers).json()["data"]
    draft["other_income"]["savings_interest"] = 0
    draft["other_income"]["deposit_interest"] = 0
    assert client.put(f"/api/v1/itr/filings/{AY}", headers=headers, json=draft).status_code == 200

    rec = _by_id(_get(client, headers))["doc_ais_income"]
    assert "₹42,000" in rec["description"] and "₹0" in rec["description"]


def test_hra_recommendation_goes_away_once_rent_is_entered(client):
    headers = _auth_headers(client)
    _upload(client, headers, "payslips", "Payslip_Mar_2026_SAMPLE.pdf")
    assert "doc_hra_claim" in _by_id(_get(client, headers))

    draft = client.get(f"/api/v1/itr/filings/{AY}", headers=headers).json()["data"]
    draft["salary"]["hra"]["rent_paid"] = 300_000
    assert client.put(f"/api/v1/itr/filings/{AY}", headers=headers, json=draft).status_code == 200
    assert "doc_hra_claim" not in _by_id(_get(client, headers))


def test_unreadable_document_is_reported_not_silently_ignored(client):
    headers = _auth_headers(client)
    _upload(client, headers, "pan", "PAN_Card_SAMPLE.png", "image/png")

    body = _get(client, headers)
    assert body["level"] == 1  # a PAN card alone doesn't reach Level 3
    assert len(body["documents"]["skipped"]) == 1
    skipped = body["documents"]["skipped"][0]
    assert skipped["category"] == "pan" and skipped["reason"]


def test_deleting_documents_drops_back_to_level_2_or_1(client):
    headers = _auth_headers(client)
    doc = _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    assert _get(client, headers)["level"] == 3

    assert client.delete(f"/api/v1/documents/{doc['id']}", headers=headers).status_code == 204
    body = _get(client, headers)
    assert body["level"] == 2  # the ITR draft the document filled in still counts as declared income
    assert body["documents"]["analysed"] == []


def test_documents_of_other_users_are_not_used(client):
    owner, other = _auth_headers(client), _auth_headers(client)
    _upload(client, owner, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    body = _get(client, other)
    assert body["level"] == 1 and body["documents"]["analysed"] == []


def test_level_3_needs_a_date_of_birth(client):
    headers = _auth_headers(client, age=None)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    body = _get(client, headers)
    assert body["level"] == 0 and body["recommendations"] == []
