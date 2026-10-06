import uuid
from datetime import date

URL = "/api/v1/resources"


def _auth_headers(client) -> dict:
    payload = {
        "name": "Resources Test",
        "email": f"resources-test-{uuid.uuid4()}@example.com",
        "password": "correct-horse-battery",
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_requires_authentication(client):
    assert client.get(URL).status_code == 401


def test_returns_alerts_and_deduction_limits(client):
    body = client.get(URL, headers=_auth_headers(client)).json()

    assert body["alerts"], "expected at least one alert"
    for alert in body["alerts"]:
        assert alert["title"]
        assert alert["date"]
        assert alert["description"]
        assert alert["category"] in {"itr_filing", "advance_tax", "investment_deadline"}

    by_section = {limit["section"]: limit for limit in body["deduction_limits"]}
    assert by_section["80C"]["limit_general"] == 150_000
    assert by_section["80D"]["limit_general"] == 25_000
    assert by_section["80D"]["limit_senior"] == 50_000
    assert by_section["24B"]["limit_general"] == 200_000
    assert by_section["80CCD(1B)"]["limit_general"] == 50_000


def test_past_alerts_are_excluded(client):
    from app.modules.resources import service

    far_future = date(2099, 1, 1)
    result = service.get_resources(today=far_future)
    assert result.alerts == []
