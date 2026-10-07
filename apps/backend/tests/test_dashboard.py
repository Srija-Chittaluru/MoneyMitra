import uuid
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.modules.dashboard import service
from app.modules.users.models import User
from tests.conftest import TestSessionLocal

URL = "/api/v1/dashboard/summary"
FIXTURES = Path(__file__).parent / "fixtures"
AY = "2026-27"


@pytest.fixture(autouse=True)
def _storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "document_storage_dir", str(tmp_path))


def _signup(client) -> tuple[dict, str]:
    email = f"dash-{uuid.uuid4()}@example.com"
    response = client.post(
        "/api/v1/auth/signup", json={"name": "Dash Test", "email": email, "password": "correct-horse-battery"}
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}, email


def _headers(client) -> dict:
    return _signup(client)[0]


def _upload(client, headers, category: str, name: str):
    response = client.post(
        "/api/v1/documents",
        data={"category": category},
        files={"file": (name, (FIXTURES / name).read_bytes(), "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401


def test_new_user_has_no_financial_data(client):
    """STATE 1: nothing is invented for a user who has provided nothing."""
    response = client.get(URL, headers=_headers(client))

    assert response.status_code == 200
    assert response.json() == {
        "source": None,
        "annual_income": None,
        "estimated_tax": None,
        "regime": None,
        "regime_unavailable_reason": None,
        "updated_at": None,
    }


def test_uploading_documents_alone_does_not_invent_income(client):
    """Only a payslip that yields no income figure leaves the summary empty."""
    headers = _headers(client)
    client.post(
        "/api/v1/documents",
        data={"category": "bills"},
        files={"file": ("electricity.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
        headers=headers,
    )

    assert client.get(URL, headers=headers).json()["annual_income"] is None


def test_income_from_a_tax_comparison_unlocks_the_numbers(client):
    """STATE 2: the user enters income; the real comparison appears."""
    headers = _headers(client)
    comparison = client.post(
        "/api/v1/tax/comparison", headers=headers, json={"tax_year": "2025-26", "gross_total_income": 1_250_000}
    ).json()

    body = client.get(URL, headers=headers).json()

    assert body["source"] == "tax_comparison"
    assert body["annual_income"] == 1_250_000
    better = comparison["recommended_regime"]
    better_tax = comparison["old_regime" if better == "old" else "new_regime"]["total_tax_payable"]
    assert body["estimated_tax"] == {"regime": "old" if better == "old" else "new", "amount": better_tax}
    assert body["regime"] == {
        "old_tax": comparison["old_regime"]["total_tax_payable"],
        "new_tax": comparison["new_regime"]["total_tax_payable"],
        "better": comparison["recommended_regime"],
        "difference": comparison["difference"],
    }
    assert body["updated_at"]


def test_summary_follows_the_users_latest_numbers(client):
    headers = _headers(client)
    client.post("/api/v1/tax/comparison", headers=headers, json={"tax_year": "2025-26", "gross_total_income": 900_000})
    client.post("/api/v1/tax/comparison", headers=headers, json={"tax_year": "2025-26", "gross_total_income": 2_000_000})

    assert client.get(URL, headers=headers).json()["annual_income"] == 2_000_000


def test_form_16_upload_fills_income_through_the_itr_draft(client):
    """STATE 4: income comes from what the document actually says."""
    headers, email = _signup(client)
    document = _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    assert document["extraction_status"] == "extracted"

    body = client.get(URL, headers=headers).json()
    assert body["source"] == "itr_filing"
    assert body["annual_income"] == 1_500_000

    with TestSessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        # Before the return's due date both regimes are comparable...
        regime = service.get_summary(db, user, today=date(2026, 6, 1)).regime
        assert regime is not None
        assert regime.better in {"old", "new", "either"}
        assert regime.difference == abs(regime.old_tax - regime.new_tax)
        # ...after it (a belated return) the old regime is gone, so income is
        # still known but no comparison is claimed.
        belated = service.get_summary(db, user, today=date(2026, 10, 6))
        assert belated.annual_income == 1_500_000
        assert belated.regime is None
        # The tax under the regime that does apply is still estimated.
        assert belated.estimated_tax is not None
        assert belated.estimated_tax.regime == "new"
        assert belated.estimated_tax.amount == 97_500


def test_users_never_see_each_others_numbers(client):
    first, second = _headers(client), _headers(client)
    client.post("/api/v1/tax/comparison", headers=first, json={"tax_year": "2025-26", "gross_total_income": 1_250_000})

    assert client.get(URL, headers=first).json()["annual_income"] == 1_250_000
    assert client.get(URL, headers=second).json()["annual_income"] is None


def test_every_uploaded_document_feeds_the_numbers(client):
    """A later upload changes the figures: the AIS adds interest income to the tax."""
    headers = _headers(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")
    before = client.get(URL, headers=headers).json()
    assert before["annual_income"] == 1_500_000 and before["estimated_tax"]["amount"] == 97_500

    _upload(client, headers, "ais", "AIS_FY2025-26_SAMPLE.pdf")  # adds ₹42,000 of interest
    after = client.get(URL, headers=headers).json()
    assert after["annual_income"] == 1_500_000
    assert after["estimated_tax"]["amount"] > before["estimated_tax"]["amount"]


def test_says_why_there_is_no_comparison_after_the_due_date(client):
    headers, email = _signup(client)
    _upload(client, headers, "form16", "Form16_AY2026-27_SAMPLE.pdf")

    with TestSessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        before_due_date = service.get_summary(db, user, today=date(2026, 6, 1))
        assert before_due_date.regime is not None and before_due_date.regime_unavailable_reason is None

        belated = service.get_summary(db, user, today=date(2026, 10, 6))
        assert belated.regime is None and belated.regime_unavailable_reason == "old_regime_closed"


def test_no_reason_is_given_when_there_is_simply_no_data(client):
    assert client.get(URL, headers=_headers(client)).json()["regime_unavailable_reason"] is None


def test_a_tax_comparison_never_claims_the_old_regime_is_closed(client):
    headers = _headers(client)
    client.post("/api/v1/tax/comparison", headers=headers, json={"tax_year": "2025-26", "gross_total_income": 1_500_000})
    body = client.get(URL, headers=headers).json()
    assert body["regime"] is not None and body["regime_unavailable_reason"] is None
