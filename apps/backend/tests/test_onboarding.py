from sqlalchemy import text

from tests.conftest import TestSessionLocal

SIGNUP_PAYLOAD = {
    "name": "Aditi Sharma",
    "email": "aditi.sharma@example.com",
    "password": "correct-horse",
}
VALID_PROFILE = {"pan": "ABCDE1234F", "date_of_birth": "1990-05-17"}


def _signup(client) -> dict:
    response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_new_user_has_no_onboarding_state(client):
    response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    user = response.json()["user"]
    assert user["tax_onboarding_status"] is None
    assert user["pan_masked"] is None


def test_save_tax_profile_completes_onboarding(client):
    headers = _signup(client)

    response = client.put("/api/v1/users/me/tax-profile", json=VALID_PROFILE, headers=headers)

    assert response.status_code == 200
    user = response.json()
    assert user["tax_onboarding_status"] == "completed"
    assert user["date_of_birth"] == "1990-05-17"
    assert user["pan_masked"] == "XXXXX1234F"


def test_pan_is_never_returned_in_full(client):
    headers = _signup(client)

    saved = client.put("/api/v1/users/me/tax-profile", json=VALID_PROFILE, headers=headers)
    me = client.get("/api/v1/auth/me", headers=headers)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": SIGNUP_PAYLOAD["email"], "password": SIGNUP_PAYLOAD["password"]},
    )

    for response in (saved, me, login):
        assert "ABCDE1234F" not in response.text
    assert me.json()["pan_masked"] == "XXXXX1234F"


def test_pan_is_encrypted_at_rest(client):
    headers = _signup(client)
    client.put("/api/v1/users/me/tax-profile", json=VALID_PROFILE, headers=headers)

    with TestSessionLocal() as db:
        stored = db.execute(text("SELECT pan_encrypted FROM users")).scalar_one()

    assert stored and "ABCDE1234F" not in stored


def test_pan_is_normalized(client):
    headers = _signup(client)

    response = client.put(
        "/api/v1/users/me/tax-profile",
        json={**VALID_PROFILE, "pan": "  abcde1234f "},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["pan_masked"] == "XXXXX1234F"


def test_invalid_pan_rejected(client):
    headers = _signup(client)

    for bad in ["", "ABCDE1234", "ABCDE12345", "1BCDE1234F", "ABCDE1234FG", "ABC-E1234F"]:
        response = client.put(
            "/api/v1/users/me/tax-profile", json={**VALID_PROFILE, "pan": bad}, headers=headers
        )
        assert response.status_code == 422, bad

    assert client.get("/api/v1/auth/me", headers=headers).json()["tax_onboarding_status"] is None


def test_invalid_date_of_birth_rejected(client):
    headers = _signup(client)

    for bad in ["2999-01-01", "1800-01-01", "not-a-date"]:
        response = client.put(
            "/api/v1/users/me/tax-profile", json={**VALID_PROFILE, "date_of_birth": bad}, headers=headers
        )
        assert response.status_code == 422, bad


def test_missing_fields_rejected(client):
    headers = _signup(client)

    assert client.put("/api/v1/users/me/tax-profile", json={"pan": "ABCDE1234F"}, headers=headers).status_code == 422
    assert client.put("/api/v1/users/me/tax-profile", json={"date_of_birth": "1990-05-17"}, headers=headers).status_code == 422


def test_skip_marks_skipped_without_saving_details(client):
    headers = _signup(client)

    response = client.post("/api/v1/users/me/tax-onboarding/skip", headers=headers)

    assert response.status_code == 200
    user = response.json()
    assert user["tax_onboarding_status"] == "skipped"
    assert user["pan_masked"] is None


def test_skipped_user_can_complete_later(client):
    headers = _signup(client)
    client.post("/api/v1/users/me/tax-onboarding/skip", headers=headers)

    response = client.put("/api/v1/users/me/tax-profile", json=VALID_PROFILE, headers=headers)

    assert response.json()["tax_onboarding_status"] == "completed"


def test_skip_does_not_undo_completion(client):
    headers = _signup(client)
    client.put("/api/v1/users/me/tax-profile", json=VALID_PROFILE, headers=headers)

    response = client.post("/api/v1/users/me/tax-onboarding/skip", headers=headers)

    assert response.json()["tax_onboarding_status"] == "completed"
    assert response.json()["pan_masked"] == "XXXXX1234F"


def test_state_persists_across_login_and_refresh(client):
    headers = _signup(client)
    client.put("/api/v1/users/me/tax-profile", json=VALID_PROFILE, headers=headers)

    login = client.post(
        "/api/v1/auth/login",
        json={"email": SIGNUP_PAYLOAD["email"], "password": SIGNUP_PAYLOAD["password"]},
    )
    refreshed = client.post("/api/v1/auth/refresh")

    assert login.json()["user"]["tax_onboarding_status"] == "completed"
    assert refreshed.json()["user"]["tax_onboarding_status"] == "completed"


def test_endpoints_require_authentication(client):
    assert client.put("/api/v1/users/me/tax-profile", json=VALID_PROFILE).status_code == 401
    assert client.post("/api/v1/users/me/tax-onboarding/skip").status_code == 401
