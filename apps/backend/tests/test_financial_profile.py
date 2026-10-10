"""The user's financial profile: monthly take-home pay and expenses."""

import uuid

import pytest

from app.modules.users.models import MAX_MONTHLY_AMOUNT

PROFILE = "/api/v1/users/me/financial-profile"


def _signup(client) -> dict:
    response = client.post(
        "/api/v1/auth/signup",
        json={"name": "Profile Test", "email": f"fp-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_needs_authentication(client):
    assert client.get(PROFILE).status_code == 401
    assert client.put(PROFILE, json={}).status_code == 401


def test_starts_empty_not_zero(client):
    assert client.get(PROFILE, headers=_signup(client)).json() == {"monthly_take_home": None, "monthly_expenses": None}


def test_save_read_and_clear(client):
    headers = _signup(client)
    saved = client.put(PROFILE, headers=headers, json={"monthly_take_home": 95_000, "monthly_expenses": 40_000})
    assert saved.status_code == 200
    assert saved.json() == {"monthly_take_home": 95_000, "monthly_expenses": 40_000}
    assert client.get(PROFILE, headers=headers).json() == saved.json()

    # Replaced as a whole: a missing or null figure is cleared.
    cleared = client.put(PROFILE, headers=headers, json={"monthly_take_home": 95_000})
    assert cleared.json() == {"monthly_take_home": 95_000, "monthly_expenses": None}


def test_zero_expenses_are_allowed(client):
    headers = _signup(client)
    response = client.put(PROFILE, headers=headers, json={"monthly_take_home": 50_000, "monthly_expenses": 0})
    assert response.json()["monthly_expenses"] == 0


@pytest.mark.parametrize(
    "body",
    [
        {"monthly_take_home": 0},
        {"monthly_take_home": -1},
        {"monthly_take_home": MAX_MONTHLY_AMOUNT + 1},
        {"monthly_take_home": 50_000.5},
        {"monthly_take_home": True},
        {"monthly_take_home": "50000"},
        {"monthly_expenses": -1},
        {"monthly_expenses": MAX_MONTHLY_AMOUNT + 1},
        {"monthly_expenses": 1.5},
        {"monthly_expenses": False},
        {"monthly_income": 50_000},
    ],
)
def test_invalid_values_are_rejected(client, body):
    headers = _signup(client)
    response = client.put(PROFILE, headers=headers, json=body)
    assert response.status_code == 422
    assert client.get(PROFILE, headers=headers).json() == {"monthly_take_home": None, "monthly_expenses": None}


def test_limits_are_accepted(client):
    headers = _signup(client)
    body = {"monthly_take_home": MAX_MONTHLY_AMOUNT, "monthly_expenses": MAX_MONTHLY_AMOUNT}
    assert client.put(PROFILE, headers=headers, json=body).status_code == 200


def test_each_user_sees_only_their_own(client):
    alice, bob = _signup(client), _signup(client)
    client.put(PROFILE, headers=alice, json={"monthly_take_home": 95_000, "monthly_expenses": 40_000})
    assert client.get(PROFILE, headers=bob).json() == {"monthly_take_home": None, "monthly_expenses": None}


def test_auth_responses_are_unchanged(client):
    signup = client.post(
        "/api/v1/auth/signup",
        json={"name": "Compat", "email": f"compat-{uuid.uuid4()}@example.com", "password": "correct-horse-battery"},
    )
    expected = {"id", "name", "email", "date_of_birth", "pan_masked", "tax_onboarding_status", "created_at"}
    assert set(signup.json()["user"]) == expected
    headers = {"Authorization": f"Bearer {signup.json()['access_token']}"}
    client.put(PROFILE, headers=headers, json={"monthly_take_home": 95_000, "monthly_expenses": 40_000})
    assert set(client.get("/api/v1/auth/me", headers=headers).json()) == expected
