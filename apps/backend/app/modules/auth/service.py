import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth.models import RefreshToken
from app.modules.auth.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.modules.users.models import User

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def _issue_session(db: Session, user: User) -> tuple[str, int, str]:
    """Creates a new access token and a new (rotated) refresh token row for a user."""
    access_token, expires_in = create_access_token(user.id)

    raw_refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            expires_at=refresh_token_expiry(),
        )
    )
    db.commit()

    return access_token, expires_in, raw_refresh_token


def signup(db: Session, name: str, email: str, password: str, date_of_birth) -> tuple[User, str, int, str]:
    normalized_email = normalize_email(email)

    if get_user_by_email(db, normalized_email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(
        name=name.strip(),
        email=normalized_email,
        password_hash=hash_password(password),
        date_of_birth=date_of_birth,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token, expires_in, raw_refresh_token = _issue_session(db, user)
    return user, access_token, expires_in, raw_refresh_token


def login(db: Session, email: str, password: str) -> tuple[User, str, int, str]:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS_MESSAGE)

    access_token, expires_in, raw_refresh_token = _issue_session(db, user)
    return user, access_token, expires_in, raw_refresh_token


def refresh_session(db: Session, raw_refresh_token: str) -> tuple[User, str, int, str]:
    token_hash = hash_refresh_token(raw_refresh_token)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    invalid_session_error = HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, please log in again")

    if stored is None or stored.revoked_at is not None:
        raise invalid_session_error

    expires_at = stored.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise invalid_session_error

    user = get_user_by_id(db, stored.user_id)
    if user is None:
        raise invalid_session_error

    # Rotate: revoke the used token, then issue a fresh pair.
    stored.revoked_at = datetime.now(timezone.utc)
    db.add(stored)
    db.commit()

    access_token, expires_in, new_raw_refresh_token = _issue_session(db, user)
    return user, access_token, expires_in, new_raw_refresh_token


def logout(db: Session, raw_refresh_token: str) -> None:
    token_hash = hash_refresh_token(raw_refresh_token)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        db.add(stored)
        db.commit()
