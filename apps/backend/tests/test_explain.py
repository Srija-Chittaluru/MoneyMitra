import uuid

from app.modules.tax import explain
from app.modules.tax.schemas import DeductionSectionBreakdown, RegimeResult, TaxComparisonResult


def _signup_and_get_token(client) -> str:
    email = f"explain-test-{uuid.uuid4()}@example.com"
    payload = {"name": "Explain Test User", "email": email, "password": "correct-horse-battery"}
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def _auth_headers(client) -> dict:
    token = _signup_and_get_token(client)
    return {"Authorization": f"Bearer {token}"}


def _regime_result(regime: str, total_tax: int) -> RegimeResult:
    return RegimeResult(
        regime=regime,
        gross_total_income=1000000,
        total_deductions=50000,
        taxable_income=950000,
        tax_before_rebate=total_tax,
        rebate=0,
        tax_after_rebate=total_tax,
        surcharge=0,
        cess=0,
        total_tax_payable=total_tax,
        slab_breakdown=[],
    )


def _sample_comparison(recommended: str = "new") -> TaxComparisonResult:
    return TaxComparisonResult(
        tax_year="2025-26",
        old_regime=_regime_result("old", 75400),
        new_regime=_regime_result("new", 0),
        recommended_regime=recommended,
        difference=75400,
        deduction_checklist=[
            DeductionSectionBreakdown(
                section="80C",
                label="Section 80C",
                limit=150000,
                declared_amount=150000,
                headroom=0,
                qualifying_instruments=["PPF", "ELSS mutual funds"],
            )
        ],
    )


# ---------------------------------------------------------------------------
# Unit-level: fallback path (no API key configured — the default in tests)
# ---------------------------------------------------------------------------


def test_fallback_used_without_api_key(monkeypatch):
    monkeypatch.setattr(explain, "get_settings", lambda: _settings_without_key())
    result = explain.generate_explanation(_sample_comparison(recommended="new"))
    assert "75,400" in result.old_regime_note
    assert "Section 80C" in result.old_regime_note
    assert "0" in result.new_regime_note
    assert "proofs" in result.old_regime_disclaimer or "documentation" in result.old_regime_disclaimer


def test_fallback_notes_no_declared_deductions(monkeypatch):
    monkeypatch.setattr(explain, "get_settings", lambda: _settings_without_key())
    comparison = _sample_comparison(recommended="new")
    comparison.deduction_checklist = []
    result = explain.generate_explanation(comparison)
    assert "haven't declared any yet" in result.old_regime_note


def test_fallback_handles_either_recommendation(monkeypatch):
    monkeypatch.setattr(explain, "get_settings", lambda: _settings_without_key())
    comparison = _sample_comparison(recommended="either")
    comparison.difference = 0
    result = explain.generate_explanation(comparison)
    assert result.old_regime_note
    assert result.new_regime_note
    assert result.old_regime_disclaimer


class _FakeSettings:
    openai_api_key = None
    openai_model = "gpt-4.1-mini"


def _settings_without_key() -> _FakeSettings:
    return _FakeSettings()


# ---------------------------------------------------------------------------
# API-level: route wiring (forced onto the fallback path, no live API calls)
# ---------------------------------------------------------------------------


def test_explain_requires_authentication(client):
    response = client.post(
        "/api/v1/tax/explain",
        json={"comparison": _sample_comparison().model_dump()},
    )
    assert response.status_code == 401


def test_explain_route_returns_fallback(client, monkeypatch):
    monkeypatch.setattr(explain, "get_settings", lambda: _settings_without_key())
    headers = _auth_headers(client)
    response = client.post(
        "/api/v1/tax/explain",
        json={"comparison": _sample_comparison().model_dump()},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["old_regime_note"]
    assert body["new_regime_note"]
    assert body["old_regime_disclaimer"]
