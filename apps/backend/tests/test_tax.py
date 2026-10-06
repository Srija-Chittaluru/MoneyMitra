import uuid
from decimal import Decimal

from app.modules.tax.age import resolve_age_category
from app.modules.tax.calculator import apply_rebate, calculate_slab_tax, calculate_surcharge, slab_breakdown
from app.modules.tax.rules.fy_2025_26 import NEW_REGIME_2025_26, OLD_REGIME_2025_26, TAX_YEAR_2025_26
from app.modules.tax.rules.types import AgeCategory

D = Decimal


def _signup_and_get_token(client, date_of_birth: str | None = None) -> str:
    email = f"tax-test-{uuid.uuid4()}@example.com"
    payload = {"name": "Tax Test User", "email": email, "password": "correct-horse-battery"}
    if date_of_birth:
        payload["date_of_birth"] = date_of_birth
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def _auth_headers(client, date_of_birth: str | None = None) -> dict:
    token = _signup_and_get_token(client, date_of_birth)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Unit-level: slab tax
# ---------------------------------------------------------------------------

GENERAL_OLD_SLABS = OLD_REGIME_2025_26.slabs_by_age[AgeCategory.GENERAL]
NEW_SLABS = NEW_REGIME_2025_26.slabs_by_age[AgeCategory.GENERAL]


def test_old_regime_general_slab_boundaries():
    assert calculate_slab_tax(D("250000"), GENERAL_OLD_SLABS) == D("0")
    assert calculate_slab_tax(D("500000"), GENERAL_OLD_SLABS) == D("12500")
    assert calculate_slab_tax(D("1000000"), GENERAL_OLD_SLABS) == D("112500")
    assert calculate_slab_tax(D("1500000"), GENERAL_OLD_SLABS) == D("262500")


def test_new_regime_slab_boundaries():
    assert calculate_slab_tax(D("400000"), NEW_SLABS) == D("0")
    assert calculate_slab_tax(D("800000"), NEW_SLABS) == D("20000")
    assert calculate_slab_tax(D("1200000"), NEW_SLABS) == D("60000")
    assert calculate_slab_tax(D("1600000"), NEW_SLABS) == D("120000")
    assert calculate_slab_tax(D("2000000"), NEW_SLABS) == D("200000")
    assert calculate_slab_tax(D("2400000"), NEW_SLABS) == D("300000")
    assert calculate_slab_tax(D("3000000"), NEW_SLABS) == D("480000")


# ---------------------------------------------------------------------------
# Unit-level: slab breakdown (bracket-by-bracket)
# ---------------------------------------------------------------------------


def test_slab_breakdown_sums_to_calculate_slab_tax():
    for income in (D("0"), D("250000"), D("500000"), D("1000000"), D("1500000")):
        breakdown = slab_breakdown(income, GENERAL_OLD_SLABS)
        assert sum((c.tax for c in breakdown), D("0")) == calculate_slab_tax(income, GENERAL_OLD_SLABS)


def test_slab_breakdown_bands_for_known_income():
    breakdown = slab_breakdown(D("900000"), NEW_SLABS)
    assert [(c.lower, c.upper, c.rate, c.amount_in_band, c.tax) for c in breakdown] == [
        (D("0"), D("400000"), D("0"), D("400000"), D("0")),
        (D("400000"), D("800000"), D("0.05"), D("400000"), D("20000")),
        (D("800000"), D("1200000"), D("0.10"), D("100000"), D("10000")),
    ]


def test_slab_breakdown_zero_income_is_empty():
    assert slab_breakdown(D("0"), GENERAL_OLD_SLABS) == []


def test_slab_breakdown_top_band_has_no_upper():
    breakdown = slab_breakdown(D("3000000"), NEW_SLABS)
    assert breakdown[-1].upper is None
    assert breakdown[-1].rate == D("0.30")


# ---------------------------------------------------------------------------
# Unit-level: rebate (section 87A)
# ---------------------------------------------------------------------------


def test_old_regime_rebate_full_at_threshold():
    tax_before = calculate_slab_tax(D("500000"), GENERAL_OLD_SLABS)
    assert apply_rebate(D("500000"), tax_before, OLD_REGIME_2025_26) == tax_before


def test_old_regime_rebate_none_above_threshold_no_marginal_relief():
    tax_before = calculate_slab_tax(D("500010"), GENERAL_OLD_SLABS)
    assert apply_rebate(D("500010"), tax_before, OLD_REGIME_2025_26) == D("0")


def test_new_regime_rebate_full_at_threshold():
    tax_before = calculate_slab_tax(D("1200000"), NEW_SLABS)
    assert apply_rebate(D("1200000"), tax_before, NEW_REGIME_2025_26) == tax_before


def test_new_regime_rebate_marginal_relief_above_threshold():
    taxable = D("1205000")
    tax_before = calculate_slab_tax(taxable, NEW_SLABS)
    rebate = apply_rebate(taxable, tax_before, NEW_REGIME_2025_26)
    assert tax_before - rebate == D("5000")  # capped at the excess over the threshold


# ---------------------------------------------------------------------------
# Unit-level: surcharge
# ---------------------------------------------------------------------------


def test_surcharge_below_threshold_is_zero():
    assert calculate_surcharge(D("4000000"), D("100000"), TAX_YEAR_2025_26.surcharge_bands, None) == D("0")


def test_surcharge_bands():
    bands = TAX_YEAR_2025_26.surcharge_bands
    assert calculate_surcharge(D("5000001"), D("100000"), bands, None) == D("10000")
    assert calculate_surcharge(D("10000001"), D("100000"), bands, None) == D("15000")
    assert calculate_surcharge(D("20000001"), D("100000"), bands, None) == D("25000")
    assert calculate_surcharge(D("50000001"), D("100000"), bands, None) == D("37000")


def test_new_regime_surcharge_is_capped():
    bands = TAX_YEAR_2025_26.surcharge_bands
    cap = TAX_YEAR_2025_26.new_regime_surcharge_cap
    assert calculate_surcharge(D("50000001"), D("100000"), bands, cap) == D("25000")


# ---------------------------------------------------------------------------
# Unit-level: age category resolution
# ---------------------------------------------------------------------------


def test_age_category_defaults_to_general_without_dob():
    assert resolve_age_category(None, "2025-26") == AgeCategory.GENERAL


def test_age_category_60_boundary():
    from datetime import date

    assert resolve_age_category(date(1966, 3, 31), "2025-26") == AgeCategory.SENIOR
    assert resolve_age_category(date(1966, 4, 1), "2025-26") == AgeCategory.GENERAL


def test_age_category_80_boundary():
    from datetime import date

    assert resolve_age_category(date(1946, 3, 31), "2025-26") == AgeCategory.SUPER_SENIOR
    assert resolve_age_category(date(1946, 4, 1), "2025-26") == AgeCategory.SENIOR


# ---------------------------------------------------------------------------
# API-level
# ---------------------------------------------------------------------------


def test_comparison_requires_authentication(client):
    response = client.post("/api/v1/tax/comparison", json={"tax_year": "2025-26", "gross_total_income": 1000000})
    assert response.status_code == 401


def test_years_requires_authentication(client):
    response = client.get("/api/v1/tax/years")
    assert response.status_code == 401


def test_list_supported_tax_years(client):
    headers = _auth_headers(client)
    response = client.get("/api/v1/tax/years", headers=headers)
    assert response.status_code == 200
    assert response.json() == ["2025-26", "2026-27"]


def test_unsupported_tax_year_rejected(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "1999-00", "gross_total_income": 1000000},
        headers=headers,
    )
    assert response.status_code == 400
    assert "Unsupported tax year" in response.json()["detail"]


def test_negative_income_rejected(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "2025-26", "gross_total_income": -1000},
        headers=headers,
    )
    assert response.status_code == 422


def test_negative_deduction_rejected(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "2025-26", "gross_total_income": 1000000, "section_80c": -500},
        headers=headers,
    )
    assert response.status_code == 422


def test_comparison_general_category_scenario(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "2025-26", "gross_total_income": 1000000, "section_80c": 150000},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["old_regime"]["taxable_income"] == 800000
    assert body["old_regime"]["total_tax_payable"] == 75400
    assert body["new_regime"]["taxable_income"] == 925000
    assert body["new_regime"]["total_tax_payable"] == 0
    assert body["recommended_regime"] == "new"
    assert body["difference"] == 75400


def test_comparison_senior_at_rebate_threshold(client):
    headers = _auth_headers(client, date_of_birth="1960-01-01")  # senior for FY 2025-26
    response = client.post(
        "/api/v1/tax/comparison",
        json={
            "tax_year": "2025-26",
            "gross_total_income": 550000,
            "date_of_birth": "1960-01-01",
        },
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["old_regime"]["taxable_income"] == 500000
    # Senior slabs are 0% up to 300000, so tax_before_rebate is 10000 here
    # (not the general category's 12500) — confirms the senior slab path ran.
    assert body["old_regime"]["tax_before_rebate"] == 10000
    assert body["old_regime"]["total_tax_payable"] == 0


def test_comparison_new_regime_marginal_relief(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "2025-26", "gross_total_income": 1280000},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["new_regime"]["taxable_income"] == 1205000
    assert body["new_regime"]["tax_after_rebate"] == 5000
    assert body["new_regime"]["total_tax_payable"] == 5200


def test_comparison_zero_income(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "2025-26", "gross_total_income": 0},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["old_regime"]["total_tax_payable"] == 0
    assert body["new_regime"]["total_tax_payable"] == 0
    assert body["recommended_regime"] == "either"
    assert body["difference"] == 0


def test_comparison_age_category_changes_old_regime_result(client):
    expectations = [
        (None, 54600),
        ("1960-01-01", 52000),  # senior
        ("1940-01-01", 41600),  # super senior
    ]
    for dob, expected_total in expectations:
        headers = _auth_headers(client, date_of_birth=dob)
        payload = {"tax_year": "2025-26", "gross_total_income": 750000}
        if dob:
            payload["date_of_birth"] = dob
        response = client.post("/api/v1/tax/comparison", json=payload, headers=headers)
        assert response.status_code == 200
        assert response.json()["old_regime"]["total_tax_payable"] == expected_total


def test_deduction_capping(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={
            "tax_year": "2025-26",
            "gross_total_income": 2000000,
            "section_80c": 500000,  # far above the 150000 cap
            "section_80d": 100000,  # far above the 25000 cap (general)
        },
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    # standard_deduction(50000) + capped 80C(150000) + capped 80D(25000)
    assert body["old_regime"]["total_deductions"] == 225000


def test_home_loan_interest_and_nps_capped(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={
            "tax_year": "2025-26",
            "gross_total_income": 1500000,
            "home_loan_interest": 300000,  # far above the 200000 cap
            "nps_contribution": 80000,  # far above the 50000 cap
        },
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    # standard_deduction(50000) + capped 24(b)(200000) + capped 80CCD(1B)(50000)
    assert body["old_regime"]["total_deductions"] == 300000


def test_deduction_checklist_values(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={
            "tax_year": "2025-26",
            "gross_total_income": 1500000,
            "section_80c": 95000,
            "section_80d": 10000,
            "hra_exemption": 40000,
            "home_loan_interest": 250000,
            "nps_contribution": 20000,
        },
        headers=headers,
    )
    assert response.status_code == 200
    checklist = {item["section"]: item for item in response.json()["deduction_checklist"]}

    assert checklist["80C"]["limit"] == 150000
    assert checklist["80C"]["declared_amount"] == 95000
    assert checklist["80C"]["headroom"] == 55000
    assert "ELSS mutual funds" in checklist["80C"]["qualifying_instruments"]

    assert checklist["HRA"]["limit"] is None
    assert checklist["HRA"]["headroom"] is None
    assert checklist["HRA"]["declared_amount"] == 40000

    assert checklist["24B"]["limit"] == 200000
    assert checklist["24B"]["declared_amount"] == 250000
    assert checklist["24B"]["headroom"] == 0
    assert "exceeds" in checklist["24B"]["note"]

    assert checklist["80CCD(1B)"]["limit"] == 50000
    assert checklist["80CCD(1B)"]["headroom"] == 30000


def test_negative_home_loan_interest_rejected(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "2025-26", "gross_total_income": 1000000, "home_loan_interest": -1},
        headers=headers,
    )
    assert response.status_code == 422


def test_comparison_response_includes_slab_breakdown(client):
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/comparison",
        json={"tax_year": "2025-26", "gross_total_income": 1000000, "section_80c": 150000},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()

    old_breakdown = body["old_regime"]["slab_breakdown"]
    assert sum(band["tax"] for band in old_breakdown) == body["old_regime"]["tax_before_rebate"]

    new_breakdown = body["new_regime"]["slab_breakdown"]
    assert sum(band["tax"] for band in new_breakdown) == body["new_regime"]["tax_before_rebate"]
    # New regime: taxable income 1,000,000 - 75,000 standard deduction = 925,000,
    # which only reaches the 800,000-1,200,000 band — the unbounded top band
    # shouldn't appear at all since the income never gets there.
    assert new_breakdown[-1] == {"lower": 800000, "upper": 1200000, "rate": 0.10, "amount_in_band": 125000, "tax": 12500}


# ---------------------------------------------------------------------------
# API-level: slab reference table
# ---------------------------------------------------------------------------


def test_slabs_requires_authentication(client):
    response = client.get("/api/v1/tax/slabs", params={"tax_year": "2025-26"})
    assert response.status_code == 401


def test_slabs_returns_full_rate_table(client):
    headers = _auth_headers(client)
    response = client.get("/api/v1/tax/slabs", params={"tax_year": "2025-26"}, headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["tax_year"] == "2025-26"
    assert body["age_category"] == "general"

    # Full reference table — unlike slab_breakdown, every band appears regardless of income.
    assert body["new_regime"] == [
        {"lower": 0, "upper": 400000, "rate": 0.0},
        {"lower": 400000, "upper": 800000, "rate": 0.05},
        {"lower": 800000, "upper": 1200000, "rate": 0.10},
        {"lower": 1200000, "upper": 1600000, "rate": 0.15},
        {"lower": 1600000, "upper": 2000000, "rate": 0.20},
        {"lower": 2000000, "upper": 2400000, "rate": 0.25},
        {"lower": 2400000, "upper": None, "rate": 0.30},
    ]
    assert body["old_regime"][0] == {"lower": 0, "upper": 250000, "rate": 0.0}
    assert body["old_regime"][-1]["upper"] is None


def test_slabs_age_category_changes_old_regime_bands(client):
    headers = _auth_headers(client)
    response = client.get(
        "/api/v1/tax/slabs",
        params={"tax_year": "2025-26", "age_category": "senior"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["old_regime"][0] == {"lower": 0, "upper": 300000, "rate": 0.0}


def test_slabs_unsupported_tax_year_rejected(client):
    headers = _auth_headers(client)
    response = client.get("/api/v1/tax/slabs", params={"tax_year": "1999-00"}, headers=headers)
    assert response.status_code == 400


def test_slabs_invalid_age_category_rejected(client):
    headers = _auth_headers(client)
    response = client.get(
        "/api/v1/tax/slabs",
        params={"tax_year": "2025-26", "age_category": "toddler"},
        headers=headers,
    )
    assert response.status_code == 422
