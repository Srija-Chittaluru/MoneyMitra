import uuid
from datetime import date

import pytest

from app.modules.recommendations.stages import LifeStage, calculate_age, resolve_life_stage

URL = "/api/v1/recommendations/life-stage"


def _auth_headers(client, date_of_birth: str | None) -> dict:
    payload = {
        "name": "Reco Test",
        "email": f"reco-test-{uuid.uuid4()}@example.com",
        "password": "correct-horse-battery",
    }
    if date_of_birth:
        payload["date_of_birth"] = date_of_birth
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _years_ago(years: int) -> str:
    today = date.today()
    return today.replace(year=today.year - years, day=min(today.day, 28)).isoformat()


# ---------------------------------------------------------------------------
# Unit-level: age and stage boundaries
# ---------------------------------------------------------------------------


def test_calculate_age_before_and_on_birthday():
    dob = date(1990, 6, 15)
    assert calculate_age(dob, date(2026, 6, 14)) == 35
    assert calculate_age(dob, date(2026, 6, 15)) == 36


@pytest.mark.parametrize(
    ("age", "stage"),
    [
        (18, LifeStage.CAREER_START),
        (29, LifeStage.CAREER_START),
        (30, LifeStage.MID_CAREER),
        (49, LifeStage.MID_CAREER),
        (50, LifeStage.PRE_RETIREMENT),
        (72, LifeStage.PRE_RETIREMENT),
    ],
)
def test_resolve_life_stage_boundaries(age, stage):
    assert resolve_life_stage(age) == stage


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401


def test_no_date_of_birth_returns_empty(client):
    response = client.get(URL, headers=_auth_headers(client, None))
    assert response.status_code == 200
    body = response.json()
    assert body["age"] is None
    assert body["stage"] is None
    assert body["recommendations"] == []


@pytest.mark.parametrize(
    ("age", "stage", "label"),
    [(25, "career_start", "Career Start"), (40, "mid_career", "Mid-Career"), (55, "pre_retirement", "Pre-Retirement")],
)
def test_stage_templates_by_age(client, age, stage, label):
    response = client.get(URL, headers=_auth_headers(client, _years_ago(age)))
    assert response.status_code == 200
    body = response.json()
    assert body["age"] == age
    assert body["stage"] == stage
    assert body["stage_label"] == label
    assert body["personalized"] is False
    assert len(body["recommendations"]) == 3
    assert all(rec["id"].startswith(stage) for rec in body["recommendations"])


def test_untouched_itr_draft_stays_age_based(client):
    headers = _auth_headers(client, _years_ago(30))
    assert client.get("/api/v1/itr/filings/2026-27", headers=headers).status_code == 200

    assert client.get(URL, headers=headers).json()["personalized"] is False


def test_itr_data_personalizes_advice(client):
    headers = _auth_headers(client, _years_ago(35))
    filing = client.get("/api/v1/itr/filings/2026-27", headers=headers).json()
    draft = filing["data"]
    draft["salary"]["salary_17_1"] = 1_200_000
    draft["deductions"]["section_80c"] = [{"description": "PPF", "amount": 100_000}]
    saved = client.put("/api/v1/itr/filings/2026-27", headers=headers, json=draft)
    assert saved.status_code == 200, saved.text

    body = client.get(URL, headers=headers).json()
    assert body["personalized"] is True
    assert body["context_source"] == "itr_filing"
    by_id = {rec["id"]: rec for rec in body["recommendations"]}
    # No 80D claim and no NPS claim in the draft.
    assert "any health insurance premium" in by_id["mid_career_health_cover"]["description"]
    assert "₹50,000" in by_id["mid_career_retirement_savings"]["description"]


def test_career_start_uses_income_and_80c_headroom(client):
    headers = _auth_headers(client, _years_ago(24))
    draft = client.get("/api/v1/itr/filings/2026-27", headers=headers).json()["data"]
    draft["salary"]["salary_17_1"] = 1_200_000
    draft["deductions"]["section_80c"] = [{"description": "ELSS", "amount": 95_000}]
    assert client.put("/api/v1/itr/filings/2026-27", headers=headers, json=draft).status_code == 200

    by_id = {rec["id"]: rec for rec in client.get(URL, headers=headers).json()["recommendations"]}
    assert "₹1,00,000 a month" in by_id["career_start_emergency_fund"]["description"]
    assert "₹55,000" in by_id["career_start_start_investing"]["description"]


def _compare(client, headers, **overrides):
    payload = {"tax_year": "2025-26", "gross_total_income": 1_800_000, **overrides}
    response = client.post("/api/v1/tax/comparison", headers=headers, json=payload)
    assert response.status_code == 200, response.text


def test_tax_comparison_inputs_personalize_advice(client):
    headers = _auth_headers(client, _years_ago(24))
    assert client.get(URL, headers=headers).json()["personalized"] is False

    _compare(client, headers, section_80c=120_000, section_80d=15_000)

    body = client.get(URL, headers=headers).json()
    assert body["personalized"] is True
    assert body["context_source"] == "tax_comparison"
    by_id = {rec["id"]: rec for rec in body["recommendations"]}
    assert "₹1,50,000 a month" in by_id["career_start_emergency_fund"]["description"]
    assert "₹30,000" in by_id["career_start_start_investing"]["description"]
    assert "already claim" in by_id["career_start_health_cover"]["description"]


def test_comparison_does_not_claim_anything_about_parents(client):
    headers = _auth_headers(client, _years_ago(40))
    _compare(client, headers, section_80d=20_000)

    by_id = {rec["id"]: rec for rec in client.get(URL, headers=headers).json()["recommendations"]}
    assert "parents" not in by_id["mid_career_health_cover"]["description"]


def test_most_recent_source_wins(client):
    headers = _auth_headers(client, _years_ago(24))
    draft = client.get("/api/v1/itr/filings/2026-27", headers=headers).json()["data"]
    draft["salary"]["salary_17_1"] = 600_000
    assert client.put("/api/v1/itr/filings/2026-27", headers=headers, json=draft).status_code == 200
    assert client.get(URL, headers=headers).json()["context_source"] == "itr_filing"

    _compare(client, headers, gross_total_income=2_400_000)

    body = client.get(URL, headers=headers).json()
    assert body["context_source"] == "tax_comparison"
    by_id = {rec["id"]: rec for rec in body["recommendations"]}
    assert "₹2,00,000 a month" in by_id["career_start_emergency_fund"]["description"]


def test_repeated_comparisons_keep_a_single_snapshot(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, gross_total_income=900_000)
    _compare(client, headers, gross_total_income=1_200_000)

    by_id = {rec["id"]: rec for rec in client.get(URL, headers=headers).json()["recommendations"]}
    assert "₹1,00,000 a month" in by_id["career_start_emergency_fund"]["description"]
