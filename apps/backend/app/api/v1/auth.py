from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.modules.auth import service
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.schemas import LoginRequest, SignupRequest, TokenResponse
from app.modules.users.models import User
from app.modules.users.schemas import UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_refresh_cookie(response: Response, raw_refresh_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw_refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        path=settings.refresh_cookie_path,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    user, access_token, expires_in, raw_refresh_token = service.signup(
        db, payload.name, payload.email, payload.password, payload.date_of_birth
    )
    _set_refresh_cookie(response, raw_refresh_token)
    return TokenResponse(access_token=access_token, expires_in=expires_in, user=UserPublic.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> TokenResponse:
    user, access_token, expires_in, raw_refresh_token = service.login(db, payload.email, payload.password)
    _set_refresh_cookie(response, raw_refresh_token)
    return TokenResponse(access_token=access_token, expires_in=expires_in, user=UserPublic.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
) -> TokenResponse:
    if refresh_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    user, access_token, expires_in, new_raw_refresh_token = service.refresh_session(db, refresh_token)
    _set_refresh_cookie(response, new_raw_refresh_token)
    return TokenResponse(access_token=access_token, expires_in=expires_in, user=UserPublic.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None, alias="refresh_token"),
) -> None:
    if refresh_token is not None:
        service.logout(db, refresh_token)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
