import uuid
from datetime import date
from types import SimpleNamespace

import pytest

from app.modules.itr.schemas import ItrDraftData
from app.modules.recommendations.context import _itr_regime_outcome
from app.modules.recommendations.money import format_inr
from app.modules.recommendations.stages import LifeStage, calculate_age, resolve_life_stage

URL = "/api/v1/recommendations"


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
# Helpers
# ---------------------------------------------------------------------------


def _get(client, headers, **params):
    response = client.get(URL, headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _by_id(body) -> dict:
    return {rec["id"]: rec for rec in body["recommendations"]}


def _set_profile(client, headers, **fields):
    payload = {"date_of_birth": None, "employee_category": None, "expected_annual_income": None, **fields}
    return client.put(f"{URL}/profile", headers=headers, json=payload)


def _compare(client, headers, **overrides):
    payload = {"tax_year": "2025-26", "gross_total_income": 1_800_000, **overrides}
    response = client.post("/api/v1/tax/comparison", headers=headers, json=payload)
    assert response.status_code == 200, response.text


def _save_itr(client, headers, salary, **deductions):
    draft = client.get("/api/v1/itr/filings/2026-27", headers=headers).json()["data"]
    draft["salary"]["salary_17_1"] = salary
    draft["deductions"].update(deductions)
    response = client.put("/api/v1/itr/filings/2026-27", headers=headers, json=draft)
    assert response.status_code == 200, response.text


# ---------------------------------------------------------------------------
# Access and level 0
# ---------------------------------------------------------------------------


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401
    assert client.put(f"{URL}/profile", json={}).status_code == 401


def test_no_date_of_birth_is_level_0(client):
    body = _get(client, _auth_headers(client, None))
    assert body["level"] == 0
    assert body["stage"] is None and body["age"] is None
    assert body["recommendations"] == []
    assert body["next_step"]["level"] == 1
    assert body["next_step"]["action_href"] is None  # "complete the profile card"


# ---------------------------------------------------------------------------
# Level 1: profile only
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("age", "stage", "label"),
    [(25, "career_start", "Career Start"), (40, "mid_career", "Mid-Career"), (55, "pre_retirement", "Pre-Retirement")],
)
def test_level_1_stage_by_age(client, age, stage, label):
    body = _get(client, _auth_headers(client, _years_ago(age)))
    assert body["level"] == 1
    assert body["age"] == age and body["stage"] == stage and body["stage_label"] == label
    assert body["context_source"] is None
    assert body["next_step"]["level"] == 2


def test_level_1_returns_tax_and_life_stage_recommendations(client):
    body = _get(client, _auth_headers(client, _years_ago(30)))
    recs = body["recommendations"]
    assert {r["category"] for r in recs} == {"tax_saving", "life_stage"}
    assert [r["category"] for r in recs] == sorted((r["category"] for r in recs), reverse=True)  # tax first
    assert sum(r["category"] == "life_stage" for r in recs) == 3
    assert all(r["level"] == 1 for r in recs)
    assert all(r["title"] and r["description"] and r["reason"] and r["basis"] for r in recs)
    assert all(r["action_href"].startswith("/") for r in recs)
    assert len({r["id"] for r in recs}) == len(recs)


def test_level_1_without_income_gives_general_regime_guidance(client):
    rec = _by_id(_get(client, _auth_headers(client, _years_ago(30))))["tax_regime_choice"]
    assert rec["title"] == "Understand the two tax regimes"
    assert rec["basis"] == "General guidance"


def test_level_1_expected_income_estimates_tax(client):
    headers = _auth_headers(client, _years_ago(30))
    assert _set_profile(client, headers, date_of_birth=_years_ago(30), expected_annual_income=800_000).status_code == 200
    low = _by_id(_get(client, headers))["tax_regime_choice"]
    assert "no income tax" in low["description"]
    assert low["basis"] == "Based on your expected income" and low["level"] == 1

    assert _set_profile(client, headers, date_of_birth=_years_ago(30), expected_annual_income=2_000_000).status_code == 200
    high = _by_id(_get(client, headers))["tax_regime_choice"]
    assert "estimated tax under the new regime is ₹" in high["description"]
    assert "no income tax" not in high["description"]


@pytest.mark.parametrize(
    ("category", "needle", "basis"),
    [
        ("government", "14% of your basic salary", "Based on your employee category"),
        ("private", "10% in the old regime", "Based on your employee category"),
        ("psu", "10% in the old regime", "Based on your employee category"),
        (None, "If your employer offers NPS", "General guidance"),
    ],
)
def test_employer_nps_depends_on_category(client, category, needle, basis):
    headers = _auth_headers(client, _years_ago(30))
    assert _set_profile(client, headers, date_of_birth=_years_ago(30), employee_category=category).status_code == 200
    rec = _by_id(_get(client, headers))["tax_employer_nps"]
    assert needle in rec["description"]
    assert rec["basis"] == basis


# ---------------------------------------------------------------------------
# Profile endpoint
# ---------------------------------------------------------------------------


def test_profile_round_trip_and_clear(client):
    headers = _auth_headers(client, None)
    dob = _years_ago(33)
    saved = _set_profile(client, headers, date_of_birth=dob, employee_category="private", expected_annual_income=1_500_000)
    assert saved.status_code == 200
    assert saved.json() == {"date_of_birth": dob, "employee_category": "private", "expected_annual_income": 1_500_000}

    body = _get(client, headers)
    assert body["level"] == 1 and body["age"] == 33
    assert body["profile"]["employee_category"] == "private"

    cleared = _set_profile(client, headers).json()
    assert cleared == {"date_of_birth": None, "employee_category": None, "expected_annual_income": None}
    assert _get(client, headers)["level"] == 0


@pytest.mark.parametrize(
    "fields",
    [
        {"date_of_birth": (date.today().replace(year=date.today().year + 1)).isoformat()},
        {"date_of_birth": "1800-01-01"},
        {"employee_category": "astronaut"},
        {"expected_annual_income": -1},
        {"expected_annual_income": 10**12},
    ],
)
def test_profile_rejects_invalid_values(client, fields):
    assert _set_profile(client, _auth_headers(client, _years_ago(30)), **fields).status_code == 422


def test_profile_rejects_unknown_fields(client):
    headers = _auth_headers(client, _years_ago(30))
    response = client.put(f"{URL}/profile", headers=headers, json={"name": "hacker"})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Level 2: declared income
# ---------------------------------------------------------------------------


def test_untouched_itr_draft_stays_level_1(client):
    headers = _auth_headers(client, _years_ago(35))
    client.get("/api/v1/itr/filings/2026-27", headers=headers)
    assert _get(client, headers)["level"] == 1


def test_level_2_from_tax_comparison(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, section_80c=120_000, section_80d=15_000)

    body = _get(client, headers)
    assert body["level"] == 2 and body["context_source"] == "tax_comparison"
    assert body["next_step"]["level"] == 3
    recs = _by_id(body)
    assert "₹1,50,000 a month" in recs["career_start_emergency_fund"]["description"]
    assert "₹30,000" in recs["tax_80c"]["description"]
    assert recs["tax_80c"]["level"] == 2
    assert recs["tax_80c"]["basis"] == "Based on your latest tax comparison"
    assert recs["career_start_emergency_fund"]["basis"] == "Based on your age and your latest tax comparison"


def test_level_2_from_itr_filing(client):
    headers = _auth_headers(client, _years_ago(38))
    _save_itr(
        client, headers, 1_200_000,
        section_80c=[{"description": "PPF", "amount": 100_000}],
        section_80ccd_1b=20_000,
    )
    body = _get(client, headers)
    assert body["level"] == 2 and body["context_source"] == "itr_filing"
    recs = _by_id(body)
    assert "₹50,000" in recs["tax_80c"]["description"]
    assert "₹30,000" in recs["mid_career_retirement_savings"]["description"]
    assert recs["tax_80c"]["basis"] == "Based on your ITR filing"


def test_80c_over_cap_shows_full_limit_not_negative(client):
    headers = _auth_headers(client, _years_ago(24))
    _save_itr(client, headers, 1_200_000, section_80c=[{"description": "A", "amount": 150_000}, {"description": "B", "amount": 50_000}])
    assert "full Section 80C limit" in _by_id(_get(client, headers))["tax_80c"]["description"]


def test_regime_outcome_new_regime_cheaper(client):
    headers = _auth_headers(client, _years_ago(30))
    _compare(client, headers, gross_total_income=1_500_000, section_80c=150_000)
    recs = _by_id(_get(client, headers))
    assert recs["tax_regime_choice"]["title"] == "The new regime looks cheaper for you"
    assert "save" in recs["tax_regime_choice"]["description"]
    assert "matters less" in recs["tax_80c"]["reason"]


def test_regime_outcome_old_regime_cheaper(client):
    headers = _auth_headers(client, _years_ago(30))
    _compare(
        client, headers, gross_total_income=2_000_000, section_80c=150_000, section_80d=25_000,
        hra_exemption=500_000, home_loan_interest=200_000, nps_contribution=50_000, other_deductions=100_000,
    )
    recs = _by_id(_get(client, headers))
    assert recs["tax_regime_choice"]["title"] == "The old regime looks cheaper for you"
    assert "matters less" not in recs["tax_80c"]["reason"]


def test_itr_filing_after_due_date_uses_the_computed_return_tax(client):
    # Old regime is closed for late returns, so there is nothing to compare; the card
    # shows the tax the return itself computes (the figure the dashboard shows).
    headers = _auth_headers(client, _years_ago(30))
    _save_itr(client, headers, 2_400_000)
    rec = _by_id(_get(client, headers))["tax_regime_choice"]
    assert rec["basis"] == "Based on your ITR filing" and rec["level"] == 2
    assert rec["title"] == "Your estimated tax under the new regime"

    dashboard = client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert format_inr(dashboard["estimated_tax"]["amount"]) in rec["description"]


def test_itr_regime_outcome_before_due_date():
    draft = ItrDraftData()
    draft.salary.salary_17_1 = 2_400_000
    filing = SimpleNamespace(assessment_year="2026-27")

    outcome = _itr_regime_outcome(filing, draft, date(2026, 7, 1))
    assert outcome is not None
    assert outcome.better == "new" and outcome.new_tax < outcome.old_tax
    assert outcome.difference == outcome.old_tax - outcome.new_tax

    assert _itr_regime_outcome(filing, draft, date(2026, 10, 1)) is None  # old regime closed
    assert _itr_regime_outcome(SimpleNamespace(assessment_year="2099-00"), draft, date(2026, 7, 1)) is None


def test_comparison_makes_no_claims_about_parents(client):
    headers = _auth_headers(client, _years_ago(40))
    _compare(client, headers, section_80d=20_000)
    assert "parents" not in _by_id(_get(client, headers))["mid_career_health_cover"]["description"]


def test_most_recent_source_wins(client):
    headers = _auth_headers(client, _years_ago(24))
    _save_itr(client, headers, 600_000)
    assert _get(client, headers)["context_source"] == "itr_filing"
    _compare(client, headers, gross_total_income=2_400_000)
    body = _get(client, headers)
    assert body["context_source"] == "tax_comparison"
    assert "₹2,00,000 a month" in _by_id(body)["career_start_emergency_fund"]["description"]


def test_zero_income_comparison_falls_back_to_level_1(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, gross_total_income=0)
    assert _get(client, headers)["level"] == 1


def test_declared_data_beats_expected_income(client):
    headers = _auth_headers(client, _years_ago(30))
    assert _set_profile(client, headers, date_of_birth=_years_ago(30), expected_annual_income=800_000).status_code == 200
    _compare(client, headers, gross_total_income=2_400_000)
    assert _by_id(_get(client, headers))["tax_regime_choice"]["basis"] == "Based on your latest tax comparison"


def test_users_are_isolated(client):
    a = _auth_headers(client, _years_ago(24))
    b = _auth_headers(client, _years_ago(24))
    _compare(client, a, gross_total_income=3_600_000)
    assert _get(client, a)["level"] == 2
    assert _get(client, b)["level"] == 1


# ---------------------------------------------------------------------------
# Tax year
# ---------------------------------------------------------------------------


def test_tax_year_defaults_to_latest_and_lists_options(client):
    body = _get(client, _auth_headers(client, _years_ago(30)))
    assert body["tax_year"] == body["available_tax_years"][-1]
    assert "2025-26" in body["available_tax_years"]


def test_explicit_tax_year_and_unsupported_year(client):
    headers = _auth_headers(client, _years_ago(30))
    assert _get(client, headers, tax_year="2025-26")["tax_year"] == "2025-26"
    assert client.get(URL, headers=headers, params={"tax_year": "1999-00"}).status_code == 400
