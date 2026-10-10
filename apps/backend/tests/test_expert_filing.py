import uuid

URL = "/api/v1/expert-filing/requests"
AY = "2026-27"


def _auth_headers(client) -> dict:
    payload = {
        "name": "Expert Filing Test",
        "email": f"expert-filing-test-{uuid.uuid4()}@example.com",
        "password": "correct-horse-battery",
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create(client, headers, **overrides):
    payload = {
        "assessment_year": AY,
        "plan": "assisted",
        "contact_phone": "9876543210",
        "preferred_time": "Weekday evenings",
        **overrides,
    }
    return client.post(URL, headers=headers, json=payload)


def test_create_request_snapshots_plan_price_and_calls(client):
    headers = _auth_headers(client)

    response = _create(client, headers, plan="premium")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plan"] == "premium"
    assert body["price"] == 1999
    assert body["calls_included"] == 1
    assert body["status"] == "pending"
    assert body["contact_phone"] == "9876543210"


def test_create_request_assisted_plan_pricing(client):
    headers = _auth_headers(client)

    response = _create(client, headers, plan="assisted")

    body = response.json()
    assert body["price"] == 499
    assert body["calls_included"] == 1


def test_get_latest_request_returns_none_when_no_request_exists(client):
    headers = _auth_headers(client)

    response = client.get(f"{URL}/latest", headers=headers, params={"assessment_year": AY})

    assert response.status_code == 200, response.text
    assert response.json() is None


def test_get_latest_request_returns_most_recent(client):
    headers = _auth_headers(client)
    _create(client, headers, plan="assisted")
    second = _create(client, headers, plan="premium")

    response = client.get(f"{URL}/latest", headers=headers, params={"assessment_year": AY})

    assert response.status_code == 200, response.text
    assert response.json()["id"] == second.json()["id"]
    assert response.json()["plan"] == "premium"


def test_requests_are_scoped_per_user(client):
    headers_a = _auth_headers(client)
    headers_b = _auth_headers(client)
    _create(client, headers_a, plan="premium")

    response = client.get(f"{URL}/latest", headers=headers_b, params={"assessment_year": AY})

    assert response.status_code == 200, response.text
    assert response.json() is None
