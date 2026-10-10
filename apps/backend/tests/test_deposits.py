import uuid

import pytest

from app.modules.deposits.service import maturity

URL = "/api/v1/deposits/rd-rates"


def _headers(client, **profile) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "RD Test", "email": f"rd-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    if profile:
        body = {"date_of_birth": None, "employee_category": None, "expected_annual_income": None, **profile}
        assert client.put("/api/v1/recommendations/profile", json=body, headers=headers).status_code == 200
    return headers


def test_maturity_matches_india_post():
    # India Post: ₹100 a month for 5 years at 6.7% matures at about ₹7,136.
    assert abs(maturity(100, 6.7, 60) - 7136) <= 1
    assert maturity(5000, 6.7, 60) == 356829
    assert maturity(1000, 0, 12) == 12000


def test_rates_carry_their_source(client):
    body = client.get(URL, headers=_headers(client)).json()

    assert [t["id"] for t in body["tenures"]] == ["1y", "2y", "3y", "5y"]
    providers = {r["provider_id"] for r in body["rates"]}
    assert len(providers - {"post_office"}) >= 10  # at least ten banks
    assert {"sbi", "icici", "hdfc", "axis", "kotak", "post_office"} <= providers
    for rate in body["rates"]:
        assert rate["source_url"].startswith("https://")
        assert rate["effective_date"]
        assert 3 < rate["annual_rate"] < 10
    # The Post Office RD is a 5-year scheme only.
    assert {r["tenure"] for r in body["rates"] if r["provider_id"] == "post_office"} == {"5y"}
    # IDFC FIRST offers no 5-year RD, so it isn't listed for that tenure.
    assert {r["tenure"] for r in body["rates"] if r["provider_id"] == "idfc_first"} == {"1y", "2y", "3y"}


def test_senior_rates_are_never_lower(client):
    rates = client.get(URL, headers=_headers(client)).json()["rates"]
    by_key = {(r["provider_id"], r["tenure"], r["customer_category"]): r["annual_rate"] for r in rates}
    for (provider, tenure, category), rate in by_key.items():
        if category == "general":
            assert by_key[(provider, tenure, "senior_citizen")] >= rate


def test_no_profile_means_no_suggestion(client):
    body = client.get(URL, headers=_headers(client)).json()
    assert body["is_senior"] is False
    assert body["suggested_monthly"] is None


@pytest.mark.parametrize("dob, income, senior, monthly", [
    ("1995-01-01", 1_200_000, False, 5000),
    ("1960-01-01", 600_000, True, 2500),
    ("1995-01-01", 50_000, False, 500),  # never below ₹500
])
def test_personalised_from_profile(client, dob, income, senior, monthly):
    body = client.get(URL, headers=_headers(client, date_of_birth=dob, expected_annual_income=income)).json()
    assert body["is_senior"] is senior
    assert body["suggested_monthly"] == monthly


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401
