"""Level 3: recommendations drawn from uploaded documents."""

import uuid
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.core.config import get_settings
from app.modules.recommendations.context import FinancialContext
from app.modules.recommendations.document_analysis import analyse
from app.modules.recommendations.facts import Facts
from app.modules.recommendations.levels import Level
from app.modules.recommendations.life_stage import idle_money, income_of, asset_mix, emergency_fund
from app.modules.recommendations.profile import EmployeeCategory
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


def _facts(analysis, declared=None, expected_income=None, category=None, age=36, stage=LifeStage.MID_CAREER) -> Facts:
    return Facts(
        level=Level.DOCUMENTS, today=TODAY, date_of_birth=date(1990, 1, 1), age=age,
        stage=stage, employee_category=category, expected_income=expected_income, declared=declared,
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
# Level 3 advice, built from what the documents say
# ---------------------------------------------------------------------------


def test_income_comes_from_documents_first():
    docs = analyse([_fake_doc(fields=FORM16_FIELDS, rows=FORM16_ROWS)], None, TODAY)
    income = income_of(_facts(docs, declared=_declared(annual_income=600_000), expected_income=300_000))
    assert income.level == 3 and income.basis == "From your Form 16" and income.monthly == 125_000

    no_docs = analyse([], None, TODAY)
    declared = income_of(_facts(no_docs, declared=_declared(annual_income=600_000), expected_income=300_000))
    assert declared.level == 2 and declared.monthly == 50_000
    expected = income_of(_facts(no_docs, expected_income=300_000))
    assert expected.level == 1 and expected.monthly == 25_000 and not expected.is_example
    assert income_of(_facts(no_docs)).is_example


def test_a_document_without_salary_does_not_set_the_income():
    ais_only_interest = analyse([_fake_doc(category="ais", fields={"other_income.savings_interest": 12_000})], None, TODAY)
    income = income_of(_facts(ais_only_interest, expected_income=1_200_000))
    assert income.level == 1 and income.monthly == 100_000


def _ais_form16(interest: dict, deposit: int = 0):
    fields = {**FORM16_FIELDS, **{f"other_income.{k}": v for k, v in interest.items()}}
    if deposit:
        fields["other_income.deposit_interest"] = deposit
    return analyse([
        _fake_doc(fields=FORM16_FIELDS, rows=FORM16_ROWS, name="f16.pdf"),
        _fake_doc(category="ais", fields=fields, name="ais.pdf"),
    ], None, TODAY)


def test_idle_savings_are_estimated_from_ais_interest():
    facts = _facts(_ais_form16({"savings_interest": 60_000}))
    rec = idle_money(facts, income_of(facts))
    # Interest of 60,000 at 3% suggests 20,00,000; income 1,25,000 a month means spending 75,000
    # and an emergency fund of 4,50,000, leaving 15,50,000, which earns 3.5% more in a deposit.
    assert rec.level == 3 and rec.basis == "From your AIS"
    assert "₹15,50,000" in rec.title and "₹54,250" in rec.description
    lines = {line.label: line.value for line in rec.illustration.lines}
    assert lines["Savings-account interest in your AIS"] == "₹60,000"
    assert lines["Money above your emergency fund"] == "₹15,50,000"
    assert rec.illustration.is_example is False
    assert "estimate" in rec.illustration.note


def test_savings_that_are_about_right_say_so():
    facts = _facts(_ais_form16({"savings_interest": 12_000}))  # about 4,00,000, below the fund
    rec = idle_money(facts, income_of(facts))
    assert rec.level == 3 and rec.title == "Your savings balance looks about right"


def test_existing_deposits_are_noticed_from_deposit_interest():
    facts = _facts(_ais_form16({"savings_interest": 60_000}, deposit=65_000))
    rec = idle_money(facts, income_of(facts))
    assert any(line.label.startswith("Deposits you already hold") and "₹10,00,000" in line.value
               for line in rec.illustration.lines)


def test_without_an_ais_the_idle_money_advice_stays_general():
    docs = analyse([_fake_doc(fields=FORM16_FIELDS, rows=FORM16_ROWS)], None, TODAY)
    facts = _facts(docs)
    rec = idle_money(facts, income_of(facts))
    assert rec.level == 1 and rec.basis == "Based on your age" and "Don't leave idle money" in rec.title

    no_interest = analyse([_fake_doc(category="ais", fields=FORM16_FIELDS)], None, TODAY)
    assert idle_money(_facts(no_interest), income_of(_facts(no_interest))).level == 1


def test_dividends_in_the_ais_are_mentioned_in_the_asset_mix():
    with_dividends = analyse([_fake_doc(category="ais", fields={**FORM16_FIELDS, "other_income.dividends.upto_15_jun": 4_000})],
                             None, TODAY)
    facts = _facts(with_dividends)
    assert "dividend income" in asset_mix(facts, income_of(facts)).description
    without = _facts(analyse([_fake_doc(category="ais", fields=FORM16_FIELDS)], None, TODAY))
    assert "dividend income" not in asset_mix(without, income_of(without)).description


def test_emergency_fund_uses_document_income_and_job_category():
    facts = _facts(analyse([_fake_doc(fields=FORM16_FIELDS, rows=FORM16_ROWS)], None, TODAY),
                   category=EmployeeCategory.GOVERNMENT)
    rec = emergency_fund(facts, income_of(facts))
    # 1,25,000 a month: spending 75,000; four months of it is 3,00,000.
    assert rec.level == 3 and "about 4 months of expenses" in rec.description and "₹3,00,000" in rec.description


# ---------------------------------------------------------------------------
# End to end, with the real sample documents
# ---------------------------------------------------------------------------


def test_no_documents_means_empty_documents_report(client):
    body = _get(client, _auth_headers(client))
    assert body["level"] == 1
    assert body["documents"] == {"analysed": [], "skipped": []}
    assert body["next_step"]["title"] == "Add your income"


def test_uploading_documents_reaches_level_3(client):
    headers = _auth_headers(client, age=25)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.pdf")
    _upload(client, headers, "payslips", "Payslip_Mar_2026_SAMPLE.pdf")

    body = _get(client, headers)
    assert body["level"] == 3 and body["level_label"] == "Your documents"
    assert body["next_step"] is None
    assert {d["category"] for d in body["documents"]["analysed"]} == {"form16", "ais", "payslips"}
    assert body["documents"]["skipped"] == []

    recs = _by_id(body)
    emergency = recs["emergency_fund"]
    assert emergency["level"] == 3
    assert emergency["basis"].startswith("From your ") and "Form 16" in emergency["basis"]
    # Form 16 salary 15,00,000 is 1,25,000 a month; spending 75,000; a 6-month fund is 4,50,000.
    assert "₹4,50,000" in emergency["description"]
    assert emergency["illustration"]["is_example"] is False
    assert all(r["category"] == "life_stage" for r in body["recommendations"])


def test_the_sample_ais_savings_look_about_right(client):
    headers = _auth_headers(client, age=40)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.pdf")  # 12,000 of savings interest

    idle = _by_id(_get(client, headers))["idle_money"]
    assert idle["level"] == 3 and idle["basis"] == "From your AIS"
    assert idle["title"] == "Your savings balance looks about right"


def test_a_document_without_usable_figures_is_reported_not_silently_ignored(client):
    headers = _auth_headers(client)
    _upload(client, headers, "pan", "PAN_Card_SAMPLE.png", "image/png")

    body = _get(client, headers)
    assert body["level"] == 1  # a PAN card alone doesn't reach Level 3
    assert len(body["documents"]["skipped"]) == 1
    skipped = body["documents"]["skipped"][0]
    assert skipped["category"] == "pan" and skipped["reason"]


def test_deleting_documents_drops_back_to_level_2(client):
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
