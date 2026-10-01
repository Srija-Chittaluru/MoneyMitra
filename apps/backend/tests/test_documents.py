import uuid

import pytest

from app.core.config import get_settings

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
AIS_JSON = b'{"AIS": {"PAN": "ABCDE1234F"}}'


@pytest.fixture(autouse=True)
def _storage_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "document_storage_dir", str(tmp_path))
    return tmp_path


def _auth_headers(client) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Doc Test", "email": f"doc-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _upload(client, headers, category="pan", name="pan.pdf", data=PDF, content_type="application/pdf"):
    return client.post(
        "/api/v1/documents",
        data={"category": category},
        files={"file": (name, data, content_type)},
        headers=headers,
    )


def test_documents_require_auth(client):
    assert client.get("/api/v1/documents").status_code == 401
    assert _upload(client, {}).status_code == 401


def test_upload_list_download_delete(client, _storage_dir):
    headers = _auth_headers(client)

    uploaded = _upload(client, headers, category="form16", name="Form16_AY2026-27.pdf")
    assert uploaded.status_code == 201, uploaded.text
    doc = uploaded.json()
    assert doc["category"] == "form16"
    assert doc["file_name"] == "Form16_AY2026-27.pdf"
    assert doc["content_type"] == "application/pdf"
    assert doc["size_bytes"] == len(PDF)
    assert len(list(_storage_dir.rglob("*.pdf"))) == 1

    listed = client.get("/api/v1/documents", headers=headers).json()
    assert [d["id"] for d in listed] == [doc["id"]]

    downloaded = client.get(f"/api/v1/documents/{doc['id']}/file", headers=headers)
    assert downloaded.status_code == 200
    assert downloaded.content == PDF
    assert downloaded.headers["content-type"] == "application/pdf"

    assert client.delete(f"/api/v1/documents/{doc['id']}", headers=headers).status_code == 204
    assert client.get("/api/v1/documents", headers=headers).json() == []
    assert list(_storage_dir.rglob("*.pdf")) == []


def test_type_detected_from_content_not_name(client):
    headers = _auth_headers(client)
    doc = _upload(client, headers, name="scan.pdf", data=PNG, content_type="application/pdf").json()
    assert doc["content_type"] == "image/png"


def test_ais_json_accepted(client):
    headers = _auth_headers(client)
    doc = _upload(client, headers, category="ais", name="AIS.json", data=AIS_JSON, content_type="application/json")
    assert doc.status_code == 201
    assert doc.json()["content_type"] == "application/json"


def test_unsupported_file_rejected(client):
    headers = _auth_headers(client)
    response = _upload(client, headers, name="notes.pdf", data=b"just text", content_type="application/pdf")
    assert response.status_code == 415


def test_empty_file_rejected(client):
    headers = _auth_headers(client)
    assert _upload(client, headers, data=b"").status_code == 400


def test_oversized_file_rejected(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_document_bytes", 100)
    headers = _auth_headers(client)
    assert _upload(client, headers, data=PDF + b"0" * 200).status_code == 413


def test_unknown_category_rejected(client):
    headers = _auth_headers(client)
    assert _upload(client, headers, category="passport").status_code == 422


def test_users_cannot_see_each_others_documents(client):
    owner = _auth_headers(client)
    other = _auth_headers(client)
    doc_id = _upload(client, owner).json()["id"]

    assert client.get("/api/v1/documents", headers=other).json() == []
    assert client.get(f"/api/v1/documents/{doc_id}/file", headers=other).status_code == 404
    assert client.delete(f"/api/v1/documents/{doc_id}", headers=other).status_code == 404
    assert client.get(f"/api/v1/documents/{doc_id}/file", headers=owner).status_code == 200


def test_path_in_filename_is_stripped(client):
    headers = _auth_headers(client)
    doc = _upload(client, headers, name="../../etc/passwd.pdf").json()
    assert doc["file_name"] == "passwd.pdf"
