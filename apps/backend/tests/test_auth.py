from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings
from app.modules.auth.security import hash_refresh_token
from tests.conftest import TestSessionLocal

settings = get_settings()

SIGNUP_PAYLOAD = {
    "name": "Aditi Sharma",
    "email": "Aditi.Sharma@Example.com",
    "password": "correct-horse",
}


def test_signup_success(client):
    response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "aditi.sharma@example.com"
    assert "password_hash" not in body["user"]
    assert body["access_token"]
    assert "refresh_token" in response.cookies


def test_signup_duplicate_email_rejected(client):
    client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
    response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    assert response.status_code == 409


def test_signup_invalid_email_rejected(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={**SIGNUP_PAYLOAD, "email": "not-an-email"},
    )

    assert response.status_code == 422


def test_signup_weak_password_rejected(client):
    response = client.post(
        "/api/v1/auth/signup",
        json={**SIGNUP_PAYLOAD, "password": "short"},
    )

    assert response.status_code == 422


def test_login_success(client):
    client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": SIGNUP_PAYLOAD["email"], "password": SIGNUP_PAYLOAD["password"]},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert "refresh_token" in response.cookies


def test_login_incorrect_password_rejected(client):
    client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": SIGNUP_PAYLOAD["email"], "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert "password_hash" not in response.text


def test_login_unknown_email_rejected(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever123"},
    )

    assert response.status_code == 401


def test_refresh_issues_new_access_token_and_rotates_cookie(client):
    signup_response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
    old_access_token = signup_response.json()["access_token"]
    old_refresh_cookie = client.cookies.get("refresh_token")

    refresh_response = client.post("/api/v1/auth/refresh")

    assert refresh_response.status_code == 200
    assert refresh_response.json()["access_token"] != old_access_token
    assert client.cookies.get("refresh_token") != old_refresh_cookie


def test_refresh_with_missing_cookie_rejected(client):
    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 401


def test_refresh_with_invalid_token_rejected(client):
    client.cookies.set("refresh_token", "not-a-real-token")

    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 401


def test_refresh_with_expired_token_rejected(client):
    from app.modules.auth.models import RefreshToken
    from app.modules.users.models import User

    db = TestSessionLocal()
    user = User(name="Test User", email="expired@example.com", password_hash="x")
    db.add(user)
    db.commit()
    db.refresh(user)

    raw_token = "expired-raw-token"
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_token),
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
    )
    db.commit()
    db.close()

    client.cookies.set("refresh_token", raw_token)
    response = client.post("/api/v1/auth/refresh")

    assert response.status_code == 401


def test_rotated_refresh_token_cannot_be_reused(client):
    client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
    old_refresh_cookie = client.cookies.get("refresh_token")

    client.post("/api/v1/auth/refresh")

    client.cookies.set("refresh_token", old_refresh_cookie)
    reuse_response = client.post("/api/v1/auth/refresh")

    assert reuse_response.status_code == 401


def test_me_authenticated(client):
    signup_response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
    access_token = signup_response.json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "aditi.sharma@example.com"
    assert "password_hash" not in body


def test_me_unauthenticated_rejected(client):
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_with_expired_access_token_rejected(client):
    signup_response = client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)
    user_id = signup_response.json()["user"]["id"]

    expired_token = jwt.encode(
        {"sub": user_id, "type": "access", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})

    assert response.status_code == 401


def test_logout_revokes_refresh_token(client):
    client.post("/api/v1/auth/signup", json=SIGNUP_PAYLOAD)

    logout_response = client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204

    refresh_response = client.post("/api/v1/auth/refresh")
    assert refresh_response.status_code == 401
