import uuid

import pytest


def _auth_headers(client) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Reco Test", "email": f"reco-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _with_profile(client) -> dict:
    """A user with a date of birth set, so the engine generates recommendations."""
    headers = _auth_headers(client)
    response = client.put(
        "/api/v1/recommendations/profile",
        json={"date_of_birth": "1995-06-15"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return headers


def _first_recommendation_id(client, headers) -> str:
    data = client.get("/api/v1/recommendations", headers=headers).json()
    assert data["recommendations"], "expected at least one recommendation for a career-start profile"
    return data["recommendations"][0]["id"]


def test_status_endpoints_require_auth(client):
    assert client.put("/api/v1/recommendations/idle_money/status", json={"status": "done"}).status_code == 401
    assert client.delete("/api/v1/recommendations/idle_money/status").status_code == 401


def test_set_status_on_unknown_id_rejected(client):
    headers = _with_profile(client)
    response = client.put(
        "/api/v1/recommendations/not_a_real_recommendation/status",
        json={"status": "done"},
        headers=headers,
    )
    assert response.status_code == 404


def test_recommendations_default_to_open(client):
    headers = _with_profile(client)
    data = client.get("/api/v1/recommendations", headers=headers).json()
    assert all(rec["status"] == "open" for rec in data["recommendations"])


def test_set_done_then_clear_back_to_open(client):
    headers = _with_profile(client)
    rec_id = _first_recommendation_id(client, headers)

    set_response = client.put(
        f"/api/v1/recommendations/{rec_id}/status", json={"status": "done"}, headers=headers
    )
    assert set_response.status_code == 200, set_response.text
    assert set_response.json() == {"recommendation_id": rec_id, "status": "done"}

    data = client.get("/api/v1/recommendations", headers=headers).json()
    statuses = {rec["id"]: rec["status"] for rec in data["recommendations"]}
    assert statuses[rec_id] == "done"

    clear_response = client.delete(f"/api/v1/recommendations/{rec_id}/status", headers=headers)
    assert clear_response.status_code == 204

    data = client.get("/api/v1/recommendations", headers=headers).json()
    statuses = {rec["id"]: rec["status"] for rec in data["recommendations"]}
    assert statuses[rec_id] == "open"


def test_set_dismissed(client):
    headers = _with_profile(client)
    rec_id = _first_recommendation_id(client, headers)

    response = client.put(
        f"/api/v1/recommendations/{rec_id}/status", json={"status": "dismissed"}, headers=headers
    )
    assert response.status_code == 200

    data = client.get("/api/v1/recommendations", headers=headers).json()
    statuses = {rec["id"]: rec["status"] for rec in data["recommendations"]}
    assert statuses[rec_id] == "dismissed"


def test_clear_nonexistent_status_404(client):
    headers = _with_profile(client)
    rec_id = _first_recommendation_id(client, headers)
    assert client.delete(f"/api/v1/recommendations/{rec_id}/status", headers=headers).status_code == 404


def test_status_is_isolated_per_user(client):
    owner = _with_profile(client)
    other = _with_profile(client)
    rec_id = _first_recommendation_id(client, owner)

    assert client.put(
        f"/api/v1/recommendations/{rec_id}/status", json={"status": "done"}, headers=owner
    ).status_code == 200

    other_data = client.get("/api/v1/recommendations", headers=other).json()
    other_statuses = {rec["id"]: rec["status"] for rec in other_data["recommendations"]}
    assert other_statuses[rec_id] == "open"


@pytest.mark.parametrize("value", ["open", "bogus"])
def test_set_status_rejects_invalid_values(client, value):
    headers = _with_profile(client)
    rec_id = _first_recommendation_id(client, headers)
    response = client.put(
        f"/api/v1/recommendations/{rec_id}/status", json={"status": value}, headers=headers
    )
    assert response.status_code == 422
