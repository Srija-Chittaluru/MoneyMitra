import uuid
from datetime import date

import pytest

from app.modules.recommendations import wealth
from app.modules.recommendations.stages import LifeStage, calculate_age, resolve_life_stage

URL = "/api/v1/recommendations"

STAGE_IDS = {
    "career_start": ["emergency_fund", "idle_money", "start_investing", "protect_income", "costly_debt"],
    "mid_career": ["idle_money", "retirement_number", "asset_mix", "family_cover", "goal_investing"],
    "pre_retirement": ["preserve_capital", "retirement_income", "idle_money", "retirement_health", "nominations"],
}


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
# Unit-level: age, stage and the arithmetic behind the examples
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


def test_sip_value_matches_the_standard_formula():
    # 5,000 a month for 10 years at 10% a year, compounded monthly.
    assert 1_020_000 < wealth.sip_value(5_000, 0.10, 10) < 1_030_000
    assert wealth.sip_value(5_000, 0.10, 0) == 0
    # More time or a higher rate always means more money.
    assert wealth.sip_value(5_000, 0.10, 20) > wealth.sip_value(5_000, 0.10, 10)
    assert wealth.sip_value(5_000, 0.10, 10) > wealth.sip_value(5_000, 0.03, 10)


def test_monthly_needed_reverses_sip_value():
    for monthly in (2_000, 5_000, 30_000):
        reached = wealth.sip_value(monthly, 0.10, 15)
        assert abs(wealth.monthly_needed(reached, 0.10, 15) - monthly) <= 1


def test_growth_and_earnings_helpers():
    assert wealth.grow(100_000, 0.06, 10) == 179_084
    assert wealth.yearly_earnings(100_000, 0.065) == 6_500
    assert wealth.round_to(12_345, 1_000) == 12_000
    assert wealth.round_to(12_600, 500) == 12_500


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
# Level 1: profile only (example figures)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("age", "stage", "label"),
    [(25, "career_start", "Career Start"), (40, "mid_career", "Mid-Career"), (55, "pre_retirement", "Pre-Retirement")],
)
def test_each_stage_gets_its_own_guidance(client, age, stage, label):
    body = _get(client, _auth_headers(client, _years_ago(age)))
    assert body["level"] == 1
    assert body["age"] == age and body["stage"] == stage and body["stage_label"] == label
    assert body["context_source"] is None
    assert [r["id"] for r in body["recommendations"]] == STAGE_IDS[stage]
    assert body["next_step"]["level"] == 2


def test_only_life_stage_advice_is_returned(client):
    """Tax-saving advice lives in Tax Comparison, Tax Planning and ITR Filing, not here."""
    for age in (25, 40, 55):
        recs = _get(client, _auth_headers(client, _years_ago(age)))["recommendations"]
        assert {r["category"] for r in recs} == {"life_stage"}
        assert not [r for r in recs if r["id"].startswith(("tax_", "doc_"))]


def test_every_recommendation_explains_how(client):
    for age in (25, 40, 55):
        for rec in _get(client, _auth_headers(client, _years_ago(age)))["recommendations"]:
            assert rec["title"] and rec["description"] and rec["reason"] and rec["basis"]
            assert len(rec["steps"]) >= 3, rec["id"]  # a concrete 'how', not just a headline
            assert rec["level"] >= 1


def test_most_advice_shows_worked_numbers_and_options(client):
    recs = _by_id(_get(client, _auth_headers(client, _years_ago(25))))
    for rec_id in ("emergency_fund", "idle_money", "start_investing", "protect_income", "costly_debt"):
        illustration = recs[rec_id]["illustration"]
        assert illustration["lines"] and illustration["title"]
        assert "Real returns vary" in illustration["note"] or "Example only" in illustration["note"]
    for rec_id in ("emergency_fund", "idle_money", "start_investing", "protect_income"):
        options = recs[rec_id]["options"]
        assert options and all(o["risk"] in {"low", "medium", "high"} and o["name"] and o["summary"] for o in options)


def test_example_figures_are_labelled_when_income_is_unknown(client):
    recs = _by_id(_get(client, _auth_headers(client, _years_ago(25))))
    emergency = recs["emergency_fund"]
    assert emergency["basis"] == "Based on your age (example figures)"
    assert emergency["illustration"]["is_example"] is True
    assert "example income of ₹50,000 a month" in emergency["illustration"]["note"]
    # 50,000 a month: spending 30,000, six months of it is 1,80,000.
    assert "₹1,80,000" in emergency["description"]


def test_advice_that_does_not_depend_on_income_is_marked_as_general(client):
    recs = _by_id(_get(client, _auth_headers(client, _years_ago(25))))
    assert recs["costly_debt"]["basis"] == "Based on your age" and recs["costly_debt"]["level"] == 1


def test_disclaimer_is_always_sent(client):
    body = _get(client, _auth_headers(client, _years_ago(30)))
    assert "not personal investment advice" in body["disclaimer"]
    assert "illustrative" in body["disclaimer"]


def test_expected_income_replaces_the_example_income(client):
    headers = _auth_headers(client, _years_ago(25))
    assert _set_profile(client, headers, date_of_birth=_years_ago(25), expected_annual_income=1_200_000).status_code == 200

    emergency = _by_id(_get(client, headers))["emergency_fund"]
    assert emergency["basis"] == "Based on your expected income" and emergency["level"] == 1
    assert emergency["illustration"]["is_example"] is False
    # 1,00,000 a month: spending 60,000, six months of it is 3,60,000.
    assert "₹3,60,000" in emergency["description"]
    assert "example income" not in emergency["illustration"]["note"]


@pytest.mark.parametrize(
    ("category", "months", "target"),
    [("government", 4, "₹2,40,000"), ("psu", 4, "₹2,40,000"), ("private", 6, "₹3,60,000"), ("other", 6, "₹3,60,000")],
)
def test_emergency_fund_size_depends_on_job_stability(client, category, months, target):
    headers = _auth_headers(client, _years_ago(25))
    assert _set_profile(client, headers, date_of_birth=_years_ago(25), employee_category=category,
                        expected_annual_income=1_200_000).status_code == 200
    emergency = _by_id(_get(client, headers))["emergency_fund"]
    assert f"about {months} months of expenses" in emergency["description"]
    assert target in emergency["description"]


def test_idle_money_example_shows_what_savings_lose_to_inflation(client):
    idle = _by_id(_get(client, _auth_headers(client, _years_ago(40))))["idle_money"]
    lines = {line["label"]: line["value"] for line in idle["illustration"]["lines"]}
    assert lines["In a savings account for a year"] == "₹3,000"
    assert lines["In a fixed deposit or liquid fund for a year"] == "₹6,500"
    assert "₹56,000" in next(v for k, v in lines.items() if "in 10 years" in k)


def test_career_start_investing_example_grows_with_time(client):
    start = _by_id(_get(client, _auth_headers(client, _years_ago(25))))["start_investing"]
    lines = start["illustration"]["lines"]
    assert len(lines) == 4
    assert "10 years" in lines[0]["label"] and "30 years" in lines[2]["label"]
    assert "savings account" in lines[3]["label"] and lines[3]["emphasis"] is True
    # The 20% of an example 50,000 income is 10,000 a month.
    assert "₹10,000 a month" in start["description"]


def test_mid_career_retirement_number_uses_age_and_income(client):
    headers = _auth_headers(client, _years_ago(40))
    assert _set_profile(client, headers, date_of_birth=_years_ago(40), expected_annual_income=1_200_000).status_code == 200
    retirement = _by_id(_get(client, headers))["retirement_number"]
    lines = {line["label"]: line["value"] for line in retirement["illustration"]["lines"]}
    # Spending 60,000 now; after 20 years of 6% price rises about 1,92,000; 25 times a year's spending.
    assert lines["Monthly spending today (about 60% of income)"] == "₹60,000"
    assert "₹1,92,000" in next(v for k, v in lines.items() if k.startswith("The same life at 60"))
    assert "₹5,76,00,000" in next(v for k, v in lines.items() if k.startswith("Pot needed"))
    assert "for the next 20 years" in retirement["description"]


def test_asset_mix_follows_the_hundred_minus_age_rule(client):
    for age, equity in ((35, 65), (45, 55)):
        mix = _by_id(_get(client, _auth_headers(client, _years_ago(age))))["asset_mix"]
        assert f"{equity}% growth, {100 - equity}% safety" in mix["illustration"]["lines"][0]["value"]


def test_pre_retirement_shifts_towards_safety(client):
    mix = _by_id(_get(client, _auth_headers(client, _years_ago(55))))["preserve_capital"]
    lines = {line["label"]: line["value"] for line in mix["illustration"]["lines"]}
    assert lines["Growth investments (45%)"] == "₹4,50,000"
    assert lines["Safer investments (55%)"] == "₹5,50,000"


def test_goal_example_needs_less_per_month_where_returns_are_higher(client):
    goal = _by_id(_get(client, _auth_headers(client, _years_ago(40))))["goal_investing"]
    amounts = [int(line["value"].split(" ")[0].replace("₹", "").replace(",", "")) for line in goal["illustration"]["lines"]]
    assert amounts[0] < amounts[1] < amounts[2]


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
# Level 2: the user's own income
# ---------------------------------------------------------------------------


def test_untouched_itr_draft_stays_level_1(client):
    headers = _auth_headers(client, _years_ago(35))
    client.get("/api/v1/itr/filings/2026-27", headers=headers)
    assert _get(client, headers)["level"] == 1


def test_level_2_from_tax_comparison_uses_real_income(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, gross_total_income=1_800_000)

    body = _get(client, headers)
    assert body["level"] == 2 and body["context_source"] == "tax_comparison"
    assert body["next_step"]["level"] == 3
    recs = _by_id(body)
    # 1,50,000 a month: spending 90,000, six months of it is 5,40,000; 20% of income is 30,000.
    assert "₹5,40,000" in recs["emergency_fund"]["description"]
    assert "₹30,000 a month" in recs["start_investing"]["description"]
    for rec_id in ("emergency_fund", "start_investing", "protect_income"):
        assert recs[rec_id]["level"] == 2
        assert recs[rec_id]["basis"] == "Based on your latest tax comparison"
        assert recs[rec_id]["illustration"]["is_example"] is False


def test_level_2_from_itr_filing(client):
    headers = _auth_headers(client, _years_ago(38))
    _save_itr(client, headers, 2_400_000)

    body = _get(client, headers)
    assert body["level"] == 2 and body["context_source"] == "itr_filing"
    retirement = _by_id(body)["retirement_number"]
    assert retirement["basis"] == "Based on your ITR filing" and retirement["level"] == 2
    assert "for the next 22 years" in retirement["description"]


def test_health_cover_advice_reads_the_declared_premiums(client):
    headers = _auth_headers(client, _years_ago(25))
    _save_itr(client, headers, 1_200_000)
    assert "no health insurance premium" in _by_id(_get(client, headers))["protect_income"]["description"]

    _save_itr(client, headers, 1_200_000,
              health_self={"claiming": True, "policies": [{"premium": 12_000}]})
    assert "already pay for health insurance" in _by_id(_get(client, headers))["protect_income"]["description"]


def test_parents_cover_is_flagged_only_when_the_itr_says_none(client):
    headers = _auth_headers(client, _years_ago(40))
    _save_itr(client, headers, 1_800_000)
    assert "no premium for your parents" in _by_id(_get(client, headers))["family_cover"]["description"]

    _save_itr(client, headers, 1_800_000, health_parents={"claiming": True, "policies": [{"premium": 20_000}]})
    assert "no premium for your parents" not in _by_id(_get(client, headers))["family_cover"]["description"]


def test_a_tax_comparison_makes_no_claim_about_parents(client):
    headers = _auth_headers(client, _years_ago(40))
    _compare(client, headers, gross_total_income=1_800_000, section_80d=20_000)
    assert "no premium for your parents" not in _by_id(_get(client, headers))["family_cover"]["description"]


def test_most_recent_source_wins(client):
    headers = _auth_headers(client, _years_ago(24))
    _save_itr(client, headers, 600_000)
    assert _get(client, headers)["context_source"] == "itr_filing"
    _compare(client, headers, gross_total_income=2_400_000)
    body = _get(client, headers)
    assert body["context_source"] == "tax_comparison"
    # 2,00,000 a month: spending 1,20,000, six months of it is 7,20,000.
    assert "₹7,20,000" in _by_id(body)["emergency_fund"]["description"]


def test_zero_income_comparison_falls_back_to_level_1(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, gross_total_income=0)
    assert _get(client, headers)["level"] == 1


def test_declared_income_beats_expected_income(client):
    headers = _auth_headers(client, _years_ago(25))
    assert _set_profile(client, headers, date_of_birth=_years_ago(25), expected_annual_income=800_000).status_code == 200
    _compare(client, headers, gross_total_income=2_400_000)
    assert _by_id(_get(client, headers))["emergency_fund"]["basis"] == "Based on your latest tax comparison"


def test_users_are_isolated(client):
    a = _auth_headers(client, _years_ago(24))
    b = _auth_headers(client, _years_ago(24))
    _compare(client, a, gross_total_income=3_600_000)
    assert _get(client, a)["level"] == 2
    assert _get(client, b)["level"] == 1
