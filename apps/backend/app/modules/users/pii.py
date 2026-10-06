import base64
import hashlib
import re
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def normalize_pan(pan: str) -> str:
    return pan.strip().upper()


def is_valid_pan(pan: str) -> bool:
    return PAN_RE.fullmatch(pan) is not None


@lru_cache
def _fernet() -> Fernet:
    settings = get_settings()
    if settings.pii_encryption_key:
        return Fernet(settings.pii_encryption_key.encode())
    if settings.environment == "production":
        raise RuntimeError("PII_ENCRYPTION_KEY must be set in production")
    # Development convenience: derive a stable key from the JWT secret.
    digest = hashlib.sha256(f"moneymitra-pii:{settings.jwt_secret}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_pan(pan: str) -> str:
    return _fernet().encrypt(pan.encode()).decode()


def decrypt_pan(token: str) -> str | None:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return None


def mask_pan(pan: str) -> str:
    """ABCDE1234F -> XXXXX1234F: enough for a user to recognise it, not enough to reuse it."""
    return f"XXXXX{pan[5:]}"
