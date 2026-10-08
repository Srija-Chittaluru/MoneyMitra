import uuid
from pathlib import Path

import pytest

from app.core.config import get_settings

URL = "/api/v1/finance/overview"
FIXTURES = Path(__file__).parent / "fixtures"
AY = "2026-27"


@pytest.fixture(autouse=True)
def _storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "document_storage_dir", str(tmp_path))


def _headers(client) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Finance Test", "email": f"fin-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _upload(client, headers, category: str, name: str):
    response = client.post(
        "/api/v1/documents",
        data={"category": category},
        files={"file": (name, (FIXTURES / name).read_bytes(), "application/pdf")},
        headers=headers,
    )
    assert response.status_code == 201, response.text


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401


def test_new_user_sees_nothing_made_up(client):
    body = client.get(URL, headers=_headers(client)).json()

    assert body["source"] is None
    for section in ("income", "tax", "filing", "investments"):
        assert body[section] is None
    assert body["tax_saving"] == []
    assert body["documents"]["uploaded"] == 0
    assert [d["category"] for d in body["documents"]["missing"]] == ["pan", "form16", "ais"]


def test_tax_comparison_gives_income_and_tax_only(client):
    headers = _headers(client)
    client.post("/api/v1/tax/comparison", headers=headers, json={"tax_year": "2025-26", "gross_total_income": 1_250_000})

    body = client.get(URL, headers=headers).json()

    assert body["source"] == "tax_comparison"
    assert body["income"] == {
        "total": 1_250_000,
        "lines": [{"key": "gross", "label": "Gross total income", "amount": 1_250_000}],
        "monthly_take_home": None,
    }
    assert body["tax"]["taxes_paid"] is None  # a comparison doesn't know what was paid
    assert body["filing"] is None


def test_documents_fill_the_overview_with_the_itr_figures(client):
    headers = _headers(client)
    for category, name in (("form16", "Form16_TRACES_SPECIMEN.pdf"), ("ais", "AIS_TIS_SPECIMEN.pdf"),
                           ("capital_gains", "Broker_TaxPnL_SPECIMEN.pdf")):
        _upload(client, headers, category, name)

    body = client.get(URL, headers=headers).json()
    summary = client.get(f"/api/v1/itr/filings/{AY}/summary", headers=headers).json()
    selected = summary["selected"]

    assert body["source"] == "itr_filing"
    assert body["financial_year"] == "2025-26"
    # Same numbers as the ITR, never a separate estimate.
    assert body["income"]["total"] == selected["gross_total_income"]
    assert sum(line["amount"] for line in body["income"]["lines"]) == selected["gross_total_income"]
    assert body["tax"]["tax"] == selected["gross_tax_liability"]
    assert body["tax"]["refund_due"] == selected["refund_due"]
    assert body["income"]["monthly_take_home"] > 0

    assert body["filing"]["form"] == summary["recommended_form"]["form"] == "ITR-3"
    assert body["investments"]["total_gain"] == selected["income_from_capital_gains"]
    assert {line["key"] for line in body["investments"]["trading"]} == {"intraday", "fno"}

    assert body["documents"]["uploaded"] == 3
    assert {d["category"] for d in body["documents"]["by_category"]} == {"form16", "ais", "capital_gains"}
    # The page already shows tax and refund; recommendations don't repeat them.
    assert not any("refund" in action["title"].lower() for action in body["actions"])
    assert "old regime" in body["tax_saving_note"]
