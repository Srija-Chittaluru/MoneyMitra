import re
from datetime import date

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.modules.users.schemas import UserPublic


# Passwords that appear at the top of every breach list.
_COMMON_PASSWORDS = {
    "password", "password1", "password123", "passw0rd", "12345678", "123456789", "1234567890", "qwerty123",
    "qwertyuiop", "11111111", "iloveyou", "abc12345", "admin123", "welcome1", "welcome123", "letmein1",
    "india123", "monkey123", "football", "baseball", "sunshine", "princess", "dragon123", "test1234",
    "moneymitra", "moneymitra1", "moneymitra123",
}


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    date_of_birth: date | None = None

    @model_validator(mode="after")
    def _strong_password(self) -> "SignupRequest":
        password = self.password
        lowered = password.lower()
        local = self.email.split("@")[0].lower()
        if lowered in _COMMON_PASSWORDS:
            raise ValueError("This password is too common — choose one that's harder to guess.")
        if len(local) >= 4 and local in lowered:
            raise ValueError("Your password shouldn't contain your email address.")
        if len(password) < 12 and not (re.search(r"[A-Za-z]", password) and re.search(r"[^A-Za-z]", password)):
            raise ValueError("Use at least 12 characters, or mix letters with numbers or symbols.")
        if len(set(password)) < 4:
            raise ValueError("This password is too easy to guess.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic
