import uuid
from datetime import date

import pytest
from sqlalchemy import select

from app.modules.planning import service as planning_service
from app.modules.planning.fy import current_financial_year, financial_year_of_assessment_year, months_remaining
from app.modules.tax.rules.registry import get_supported_tax_years
from app.modules.users.models import User
from tests.conftest import TestSessionLocal

URL = "/api/v1/planning/tax-plan"


def _auth_headers(client, date_of_birth: str | None = None) -> dict:
    payload = {
        "name": "Planning Test",
        "email": f"planning-test-{uuid.uuid4()}@example.com",
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
# Unit-level: financial-year date math
# ---------------------------------------------------------------------------


def test_current_financial_year_mid_year():
    label, start, end = current_financial_year(date(2026, 10, 1))
    assert label == "2026-27"
    assert start == date(2026, 4, 1)
    assert end == date(2027, 3, 31)


def test_current_financial_year_before_april():
    label, start, end = current_financial_year(date(2026, 3, 31))
    assert label == "2025-26"
    assert start == date(2025, 4, 1)
    assert end == date(2026, 3, 31)


def test_months_remaining_start_of_year():
    assert months_remaining(date(2026, 4, 1), date(2027, 3, 31)) == 12


def test_months_remaining_mid_year():
    assert months_remaining(date(2026, 10, 1), date(2027, 3, 31)) == 6


def test_months_remaining_last_day_is_at_least_one():
    assert months_remaining(date(2027, 3, 31), date(2027, 3, 31)) == 1


def test_assessment_year_maps_to_the_previous_financial_year():
    assert financial_year_of_assessment_year("2026-27") == "2025-26"
    assert financial_year_of_assessment_year("2027-28") == "2026-27"
    assert financial_year_of_assessment_year("2099-00") == "2098-99"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _this_fy() -> str:
    label, _, _ = current_financial_year(date.today())
    if label not in get_supported_tax_years():
        pytest.skip(f"no tax rules for the current financial year ({label}) yet")
    return label


def _last_fy() -> str:
    label, _, _ = current_financial_year(date(date.today().year - 1 if date.today().month >= 4 else date.today().year - 2, 6, 1))
    return label


def _compare(client, headers, tax_year: str, **fields):
    payload = {"tax_year": tax_year, "gross_total_income": 1_500_000, **fields}
    assert client.post("/api/v1/tax/comparison", headers=headers, json=payload).status_code == 200
    return payload


def _by_section(body) -> dict:
    return {s["section"]: s for s in body["sections"]}


def _save_itr(client, headers, **changes):
    draft = client.get("/api/v1/itr/filings/2026-27", headers=headers).json()["data"]
    draft["salary"]["salary_17_1"] = changes.pop("salary", 1_200_000)
    draft["deductions"].update(changes.pop("deductions", {}))
    for key, value in changes.items():
        draft[key] = value
    assert client.put("/api/v1/itr/filings/2026-27", headers=headers, json=draft).status_code == 200


def _plan_on(client, headers, today: date):
    """The plan as it would look on `today`, built straight from the service."""
    db = TestSessionLocal()
    try:
        user = db.scalar(select(User).order_by(User.created_at.desc()))
        return planning_service.get_tax_plan(db, user, today)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Endpoint basics
# ---------------------------------------------------------------------------


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401


def test_no_financial_data_returns_empty_state(client):
    response = client.get(URL, headers=_auth_headers(client, _years_ago(24)))
    assert response.status_code == 200
    body = response.json()
    assert body["has_data"] is False
    assert body["sections"] == []
    assert body["context_source"] is None
    assert body["regime_position"] is None
    assert body["data_fy_label"] is None and body["data_is_current_year"] is False
    # Time context is still computable with no financial data at all.
    assert body["months_remaining"] >= 1
    assert body["regime_caveat"]


def test_no_date_of_birth_still_returns_time_context(client):
    body = client.get(URL, headers=_auth_headers(client)).json()
    assert body["age"] is None
    assert body["stage_label"] is None
    assert body["fy_label"]


# ---------------------------------------------------------------------------
# Figures for the current year count as progress
# ---------------------------------------------------------------------------


def test_this_years_comparison_personalizes_sections(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, _this_fy(), section_80c=95_000, section_80d=10_000, home_loan_interest=50_000)

    body = client.get(URL, headers=headers).json()
    assert body["has_data"] is True
    assert body["context_source"] == "tax_comparison"
    assert body["data_is_current_year"] is True and body["data_fy_label"] == body["fy_label"]
    sections = _by_section(body)

    section_80c = sections["80C"]
    assert section_80c["cap"] == 150_000
    assert section_80c["declared_amount"] == 95_000
    assert section_80c["headroom"] == 55_000
    assert section_80c["last_year_amount"] is None and section_80c["carried_forward"] is False

    # Structured instrument options, not a flat name list.
    instrument_names = {inst["name"] for inst in section_80c["instruments"]}
    assert "PPF" in instrument_names
    assert "ELSS mutual funds" in instrument_names
    elss = next(inst for inst in section_80c["instruments"] if inst["name"] == "ELSS mutual funds")
    assert elss["lock_in"] == "3 years"
    assert elss["type"]
    assert elss["description"]
    assert elss["why"]
    assert elss["link"] == "https://investor.sebi.gov.in/elss.html"

    # Instruments with no verified official page omit the link rather than guess one.
    fd = next(inst for inst in section_80c["instruments"] if inst["name"] == "5-year tax-saving FD")
    assert fd["link"] is None
    months = body["months_remaining"]
    assert section_80c["monthly_target"] == -(-55_000 // months)

    # 80CCD(1B) fully unclaimed — monthly target should cover the whole cap.
    nps = sections["80CCD(1B)"]
    assert nps["headroom"] == 50_000
    assert nps["monthly_target"] == -(-50_000 // months)


def test_fully_used_section_has_no_monthly_target(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, _this_fy(), section_80c=150_000)

    sections = _by_section(client.get(URL, headers=headers).json())
    assert sections["80C"]["headroom"] == 0
    assert sections["80C"]["monthly_target"] == 0


def test_senior_citizen_gets_higher_80d_cap(client):
    headers = _auth_headers(client, _years_ago(65))
    _compare(client, headers, _this_fy(), gross_total_income=1_000_000, section_80d=10_000)

    assert _by_section(client.get(URL, headers=headers).json())["80D"]["cap"] == 50_000


def test_sections_exclude_hra(client):
    headers = _auth_headers(client, _years_ago(24))
    _compare(client, headers, _this_fy(), gross_total_income=1_000_000, hra_exemption=50_000)

    sections = {s["section"] for s in client.get(URL, headers=headers).json()["sections"]}
    assert "HRA" not in sections


# ---------------------------------------------------------------------------
# Figures for last year are a reference, not this year's progress
# ---------------------------------------------------------------------------


def test_last_years_comparison_does_not_count_as_progress(client):
    headers = _auth_headers(client, _years_ago(30))
    _compare(client, headers, _last_fy(), section_80c=150_000, section_80d=20_000, nps_contribution=50_000,
             home_loan_interest=120_000)

    body = client.get(URL, headers=headers).json()
    assert body["data_is_current_year"] is False and body["data_fy_label"] == _last_fy()
    sections = _by_section(body)
    months = body["months_remaining"]

    for key, cap, amount in (("80C", 150_000, 150_000), ("80CCD(1B)", 50_000, 50_000), ("80D", 25_000, 20_000)):
        assert sections[key]["declared_amount"] == 0
        assert sections[key]["headroom"] == cap
        assert sections[key]["monthly_target"] == -(-cap // months)
        assert sections[key]["last_year_amount"] == amount
        assert sections[key]["carried_forward"] is False

    # Home loan interest repeats by itself, so it is carried forward.
    loan = sections["24B"]
    assert loan["declared_amount"] == 120_000 and loan["carried_forward"] is True
    assert loan["headroom"] == 80_000 and loan["last_year_amount"] is None
    assert loan["monthly_target"] == 0  # there's nothing to invest in

    assert "FY " + _last_fy() in body["regime_caveat"] and "assuming they stay the same" in body["regime_caveat"]


def test_untouched_section_has_no_last_year_reference(client):
    headers = _auth_headers(client, _years_ago(30))
    _compare(client, headers, _last_fy(), section_80c=50_000)  # nothing in 80D or NPS

    sections = _by_section(client.get(URL, headers=headers).json())
    assert sections["80C"]["last_year_amount"] == 50_000
    assert sections["80D"]["last_year_amount"] is None
    assert sections["24B"]["carried_forward"] is False


def test_itr_draft_for_ay_2026_27_is_last_year_after_march_2026(client):
    headers = _auth_headers(client, _years_ago(35))
    _save_itr(client, headers, deductions={"section_80c": [{"description": "PPF", "amount": 100_000}]})

    after = _plan_on(client, headers, date(2026, 10, 6))  # FY 2026-27
    assert after.data_fy_label == "2025-26" and after.data_is_current_year is False
    assert _by_section(after.model_dump())["80C"]["declared_amount"] == 0
    assert _by_section(after.model_dump())["80C"]["last_year_amount"] == 100_000

    during = _plan_on(client, headers, date(2026, 2, 1))  # FY 2025-26: the ITR's own year
    assert during.data_is_current_year is True
    assert _by_section(during.model_dump())["80C"]["declared_amount"] == 100_000


def test_itr_draft_personalizes_80d_and_home_loan(client):
    headers = _auth_headers(client, _years_ago(35))
    _save_itr(
        client, headers,
        deductions={"health_self": {"claiming": True, "policies": [{"premium": 12_000}], "preventive_checkup": 3_000}},
        house_properties=[{"property_type": "self_occupied", "interest_on_loan": 150_000}],
    )

    plan = _plan_on(client, headers, date(2026, 2, 1)).model_dump()
    assert plan["context_source"] == "itr_filing"
    sections = _by_section(plan)
    assert sections["80D"]["declared_amount"] == 15_000
    assert sections["24B"]["declared_amount"] == 150_000
    assert sections["24B"]["headroom"] == 50_000
    assert sections["24B"]["monthly_target"] == 0


# ---------------------------------------------------------------------------
# The regime estimate
# ---------------------------------------------------------------------------


def test_regime_position_matches_direct_comparison_call(client):
    headers = _auth_headers(client, _years_ago(30))
    payload = _compare(client, headers, _this_fy(), section_80c=95_000, section_80d=10_000, home_loan_interest=50_000)

    direct = client.post("/api/v1/tax/comparison", headers=headers, json=payload).json()
    plan = client.get(URL, headers=headers).json()
    assert plan["regime_position"]["recommended_regime"] == direct["recommended_regime"]
    assert plan["regime_position"]["difference"] == direct["difference"]


def test_regime_estimate_uses_hra_other_income_and_parents(client):
    headers = _auth_headers(client, _years_ago(35))
    draft = client.get("/api/v1/itr/filings/2026-27", headers=headers).json()["data"]
    draft["salary"]["salary_17_1"] = 2_000_000
    draft["salary"]["hra"] = {"basic_salary": 800_000, "hra_received": 320_000, "rent_paid": 360_000, "is_metro": True}
    draft["other_income"]["savings_interest"] = 40_000
    draft["deductions"]["health_self"] = {"claiming": True, "policies": [{"premium": 10_000}]}
    draft["deductions"]["health_parents"] = {"claiming": True, "policies": [{"premium": 30_000}]}
    assert client.put("/api/v1/itr/filings/2026-27", headers=headers, json=draft).status_code == 200

    # Old-regime HRA exemption: the lowest of HRA received (3,20,000), rent minus 10% of basic
    # (3,60,000 - 80,000 = 2,80,000) and 50% of basic for a metro (4,00,000).
    hra_exemption = 280_000

    plan = _plan_on(client, headers, date(2026, 10, 6))
    expected = client.post(
        "/api/v1/tax/comparison",
        headers=headers,
        json={
            "tax_year": "2026-27",
            "gross_total_income": 2_000_000 + 40_000,
            "section_80d": 10_000,
            "hra_exemption": hra_exemption,
            "other_deductions": 25_000,  # the parents' 30,000, capped at their own limit
        },
    ).json()
    assert plan.regime_position.recommended_regime == expected["recommended_regime"]
    assert plan.regime_position.difference == expected["difference"]


def test_parents_premiums_have_their_own_limit_and_a_note(client):
    headers = _auth_headers(client, _years_ago(35))
    _save_itr(client, headers, deductions={
        "health_self": {"claiming": True, "policies": [{"premium": 10_000}]},
        "health_parents": {"claiming": True, "policies": [{"premium": 30_000}]},
    })
    sections = _by_section(_plan_on(client, headers, date(2026, 2, 1)).model_dump())
    assert sections["80D"]["declared_amount"] == 10_000  # your own cover only
    assert sections["80D"]["cap"] == 25_000
    assert "₹30,000" in sections["80D"]["note"] and "own limit" in sections["80D"]["note"]
    assert sections["80C"]["note"] is None


def test_senior_cover_flag_in_the_itr_draft_raises_the_80d_cap(client):
    headers = _auth_headers(client, _years_ago(40))  # not a senior citizen themselves
    _save_itr(client, headers, deductions={
        "health_self": {"claiming": True, "includes_senior_citizen": True, "policies": [{"premium": 40_000}]},
    })
    assert _by_section(_plan_on(client, headers, date(2026, 2, 1)).model_dump())["80D"]["cap"] == 50_000


def test_unsupported_financial_year_drops_the_regime_banner_not_the_page(client):
    headers = _auth_headers(client, _years_ago(30))
    _save_itr(client, headers)

    plan = _plan_on(client, headers, date(2031, 5, 1))  # FY 2031-32 has no tax rules
    assert plan.has_data is True and plan.regime_position is None
    assert len(plan.sections) == 4
