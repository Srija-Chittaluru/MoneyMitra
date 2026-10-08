import shutil
import uuid
from io import BytesIO
from pathlib import Path

import pytest
from reportlab.pdfgen import canvas

from app.core.config import get_settings
from app.modules.extraction.guardrails import classify
from app.modules.extraction.parsers import extract, fix_pan, pdf_lines

FIXTURES = Path(__file__).parent / "fixtures"
AY = "2026-27"
needs_ocr = pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract OCR not installed")


def _fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def _pdf(*lines: str) -> bytes:
    out = BytesIO()
    c = canvas.Canvas(out)
    for i, line in enumerate(lines):
        c.drawString(72, 750 - i * 18, line)
    c.save()
    return out.getvalue()


@pytest.fixture(autouse=True)
def _storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "document_storage_dir", str(tmp_path))


def _auth_headers(client) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Guard Test", "email": f"guard-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _upload(client, headers, category: str, data: bytes, name: str = "doc.pdf", content_type="application/pdf"):
    return client.post("/api/v1/documents", data={"category": category},
                       files={"file": (name, data, content_type)}, headers=headers)


@pytest.mark.parametrize("name, expected", [
    ("Form16_TRACES_SPECIMEN.pdf", "form16"), ("Form16_AY2026-27_SAMPLE.pdf", "form16"),
    ("AIS_TIS_SPECIMEN.pdf", "ais"), ("AIS_FY2025-26_SAMPLE.pdf", "ais"),
    ("Payslip_YTD_SPECIMEN.pdf", "payslips"), ("Payslip_Mar_2026_SAMPLE.pdf", "payslips"),
    ("Form26AS_SPECIMEN.pdf", "form26as"), ("Broker_TaxPnL_SPECIMEN.pdf", "capital_gains"),
])
def test_documents_are_recognised_by_content(name, expected):
    assert classify(pdf_lines(_fixture(name), [])) == expected


def test_form16_uploaded_as_26as_is_rejected(client):
    headers = _auth_headers(client)
    response = _upload(client, headers, "form26as", _fixture("Form16_TRACES_SPECIMEN.pdf"))
    assert response.status_code == 422
    assert "looks like Form 16, not Form 26AS" in response.json()["detail"]
    assert client.get("/api/v1/documents", headers=headers).json() == []  # nothing stored


def test_tax_document_under_other_is_redirected(client):
    headers = _auth_headers(client)
    response = _upload(client, headers, "other", _fixture("Form16_TRACES_SPECIMEN.pdf"))
    assert response.status_code == 422
    assert "Upload it under “Form 16”" in response.json()["detail"]


def test_unrelated_document_is_rejected(client):
    headers = _auth_headers(client)
    response = _upload(client, headers, "form16", _pdf("Electricity bill", "Amount due Rs 1,240.00"))
    assert response.status_code == 422
    assert "doesn't look like a Form 16" in response.json()["detail"]
    # The same bill is fine under Bills.
    assert _upload(client, headers, "bills", _pdf("Electricity bill", "Amount due Rs 1,240.00")).status_code == 201


def test_someone_elses_document_is_rejected(client):
    headers = _auth_headers(client)
    assert _upload(client, headers, "form16", _fixture("Form16_TRACES_SPECIMEN.pdf")).status_code == 201
    response = _upload(client, headers, "ais", _fixture("AIS_FY2025-26_SAMPLE.pdf"))  # PAN ABCDE1234F
    assert response.status_code == 422
    assert "is for PAN ABCDE1234F, but your return is for PAN BXKPM4821Q" in response.json()["detail"]


def test_wrong_year_payslip_is_rejected(client):
    headers = _auth_headers(client)
    response = _upload(client, headers, "payslips",
                       _pdf("ACME PRIVATE LIMITED", "Payslip for April 2026", "Net pay Rs 1,00,000.00"))
    assert response.status_code == 422
    assert "outside FY 2025-26" in response.json()["detail"]


def test_same_file_twice_is_rejected(client):
    headers = _auth_headers(client)
    assert _upload(client, headers, "form16", _fixture("Form16_TRACES_SPECIMEN.pdf")).status_code == 201
    response = _upload(client, headers, "form16", _fixture("Form16_TRACES_SPECIMEN.pdf"), name="copy.pdf")
    assert response.status_code == 409
    assert "already uploaded" in response.json()["detail"]


def test_fix_pan_repairs_ocr_confusions():
    assert fix_pan("BXKPM482lQ".upper()) == "BXKPM4821Q"
    assert fix_pan("8XKPM4821Q") == "BXKPM4821Q"
    assert fix_pan("GOVERNMENT") is None


@needs_ocr
def test_pan_card_photo_is_read_with_ocr(client):
    ex = extract("pan", "image/png", _fixture("PAN_Card_SPECIMEN.png"), [])
    assert ex.fields["personal.pan"] == "BXKPM4821Q"
    assert ex.fields["personal.father_name"].upper() == "VIKRAM SURESH MEHTA"
    assert ex.fields["personal.date_of_birth"] == "1991-08-14"
    assert (ex.fields["personal.first_name"], ex.fields["personal.last_name"]) == ("ROHAN", "MEHTA")
    assert ex.facts["ocr"] is True

    headers = _auth_headers(client)
    doc = _upload(client, headers, "pan", _fixture("PAN_Card_SPECIMEN.png"), "pan.png", "image/png").json()
    assert doc["extraction_status"] == "extracted"
    data = client.get(f"/api/v1/itr/filings/{AY}", headers=headers).json()["data"]
    assert data["personal"]["father_name"].upper() == "VIKRAM SURESH MEHTA"


@needs_ocr
def test_pan_photo_uploaded_as_form16_is_rejected(client):
    headers = _auth_headers(client)
    response = _upload(client, headers, "form16", _fixture("PAN_Card_SPECIMEN.png"), "pan.png", "image/png")
    assert response.status_code == 422
    assert "looks like PAN card" in response.json()["detail"]
