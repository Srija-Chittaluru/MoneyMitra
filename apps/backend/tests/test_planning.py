import uuid
from datetime import date

from app.modules.planning.fy import current_financial_year, months_remaining

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


# ---------------------------------------------------------------------------
# Endpoint
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
    # Time context is still computable with no financial data at all.
    assert body["months_remaining"] >= 1
    assert body["regime_caveat"]


def test_no_date_of_birth_still_returns_time_context(client):
    body = client.get(URL, headers=_auth_headers(client)).json()
    assert body["age"] is None
    assert body["stage_label"] is None
    assert body["fy_label"]


def test_tax_comparison_personalizes_sections(client):
    headers = _auth_headers(client, _years_ago(24))
    payload = {
        "tax_year": "2025-26",
        "gross_total_income": 1_500_000,
        "section_80c": 95_000,
        "section_80d": 10_000,
        "home_loan_interest": 50_000,
        "nps_contribution": 0,
    }
    assert client.post("/api/v1/tax/comparison", headers=headers, json=payload).status_code == 200

    body = client.get(URL, headers=headers).json()
    assert body["has_data"] is True
    assert body["context_source"] == "tax_comparison"
    by_section = {s["section"]: s for s in body["sections"]}

    section_80c = by_section["80C"]
    assert section_80c["cap"] == 150_000
    assert section_80c["declared_amount"] == 95_000
    assert section_80c["headroom"] == 55_000

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
    nps = by_section["80CCD(1B)"]
    assert nps["headroom"] == 50_000
    assert nps["monthly_target"] == -(-50_000 // months)


def test_fully_used_section_has_no_monthly_target(client):
    headers = _auth_headers(client, _years_ago(24))
    payload = {
        "tax_year": "2025-26",
        "gross_total_income": 1_500_000,
        "section_80c": 150_000,
    }
    assert client.post("/api/v1/tax/comparison", headers=headers, json=payload).status_code == 200

    by_section = {s["section"]: s for s in client.get(URL, headers=headers).json()["sections"]}
    assert by_section["80C"]["headroom"] == 0
    assert by_section["80C"]["monthly_target"] == 0


def test_itr_draft_personalizes_80d_and_home_loan(client):
    headers = _auth_headers(client, _years_ago(35))
    draft = client.get("/api/v1/itr/filings/2026-27", headers=headers).json()["data"]
    draft["salary"]["salary_17_1"] = 1_200_000
    draft["deductions"]["health_self"] = {
        "claiming": True,
        "policies": [{"premium": 12_000}],
        "preventive_checkup": 3_000,
    }
    draft["house_properties"] = [{"property_type": "self_occupied", "interest_on_loan": 150_000}]
    assert client.put("/api/v1/itr/filings/2026-27", headers=headers, json=draft).status_code == 200

    body = client.get(URL, headers=headers).json()
    assert body["context_source"] == "itr_filing"
    by_section = {s["section"]: s for s in body["sections"]}
    assert by_section["80D"]["declared_amount"] == 15_000
    assert by_section["24B"]["declared_amount"] == 150_000
    assert by_section["24B"]["headroom"] == 50_000


def test_senior_citizen_gets_higher_80d_cap(client):
    headers = _auth_headers(client, _years_ago(65))
    payload = {"tax_year": "2025-26", "gross_total_income": 1_000_000, "section_80d": 10_000}
    assert client.post("/api/v1/tax/comparison", headers=headers, json=payload).status_code == 200

    by_section = {s["section"]: s for s in client.get(URL, headers=headers).json()["sections"]}
    assert by_section["80D"]["cap"] == 50_000


def test_regime_position_matches_direct_comparison_call(client):
    headers = _auth_headers(client, _years_ago(30))
    payload = {
        "tax_year": "2025-26",
        "gross_total_income": 1_500_000,
        "section_80c": 95_000,
        "section_80d": 10_000,
        "home_loan_interest": 50_000,
    }
    assert client.post("/api/v1/tax/comparison", headers=headers, json=payload).status_code == 200

    fy_label, _, _ = current_financial_year(date.today())
    direct = client.post(
        "/api/v1/tax/comparison", headers=headers, json={**payload, "tax_year": fy_label}
    ).json()

    plan = client.get(URL, headers=headers).json()
    assert plan["regime_position"]["recommended_regime"] == direct["recommended_regime"]
    assert plan["regime_position"]["difference"] == direct["difference"]


def test_sections_exclude_hra(client):
    headers = _auth_headers(client, _years_ago(24))
    payload = {"tax_year": "2025-26", "gross_total_income": 1_000_000, "hra_exemption": 50_000}
    assert client.post("/api/v1/tax/comparison", headers=headers, json=payload).status_code == 200

    sections = {s["section"] for s in client.get(URL, headers=headers).json()["sections"]}
    assert "HRA" not in sections
